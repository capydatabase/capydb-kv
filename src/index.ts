/**
 * @capydb/kv - CapyDB K/V (CapyDB Knight/Valkyrie) helpers.
 *
 * A thin, typed convenience layer over `@upstash/redis` (a peer dependency)
 * that does two things and nothing else:
 *
 * 1. Reads CapyDB's own environment variables. CapyDB's deployment
 *    integrations push `CAPYDB_KV_REST_URL` and `CAPYDB_KV_REST_TOKEN`, not
 *    the `UPSTASH_*` names that `Redis.fromEnv()` looks for, so
 *    `fromEnv()` cannot find them. This package is the equivalent.
 * 2. Fails fast when configuration is missing. Constructing `new Redis({})`
 *    with an absent url or token does NOT throw - the client only
 *    `console.warn`s and then fails later, at request time, from wherever the
 *    first command happens to run. A deploy missing an environment variable
 *    should break at startup with a message naming the variable, not
 *    mid-request with a connection error.
 *
 * You do not need this package. CapyDB's K/V speaks the same HTTP protocol
 * `@upstash/redis` already speaks, so this works with no dependency on us:
 *
 * ```ts
 * import { Redis } from "@upstash/redis"
 * const redis = new Redis({
 *   url: process.env.CAPYDB_KV_REST_URL!,
 *   token: process.env.CAPYDB_KV_REST_TOKEN!,
 * })
 * ```
 *
 * That is the whole difference. Use this package if you want the environment
 * handling and the startup check; skip it if you would rather not add a
 * dependency. Rate limiting needs nothing from here either - pass the client
 * straight to `@upstash/ratelimit`:
 *
 * ```ts
 * import { Ratelimit } from "@upstash/ratelimit"
 * import { createKv } from "@capydb/kv"
 *
 * const ratelimit = new Ratelimit({
 *   redis: createKv(),
 *   limiter: Ratelimit.slidingWindow(10, "10 s"),
 * })
 * ```
 */
import { Redis, type RedisConfigNodejs } from "@upstash/redis";

/** Env vars checked (in order) for the REST endpoint. */
const URL_ENV_VARS = ["CAPYDB_KV_REST_URL", "UPSTASH_REDIS_REST_URL"] as const;

/** Env vars checked (in order) for the access token. */
const TOKEN_ENV_VARS = ["CAPYDB_KV_REST_TOKEN", "UPSTASH_REDIS_REST_TOKEN"] as const;

/**
 * Thrown when the K/V endpoint or token cannot be resolved, or resolves to
 * something unusable.
 *
 * This is the entire reason the package exists: `@upstash/redis` treats a
 * missing url or token as a warning, so the failure surfaces later and
 * somewhere else. Naming the missing variable at construction turns a confusing
 * runtime error into an obvious deployment one.
 */
export class CapyKVConfigError extends Error {
  override readonly name = "CapyKVConfigError";
}

/** Resolved connection details for a CapyDB K/V store. */
export interface CapyKVCredentials {
  /** HTTPS endpoint, without a trailing slash. */
  url: string;
  /** The `capy_kv_` access token. */
  token: string;
}

export interface CreateKVOptions {
  /**
   * Overrides the resolved endpoint. Falls back to `CAPYDB_KV_REST_URL`, then
   * `UPSTASH_REDIS_REST_URL` (so an app migrating from Upstash keeps working
   * before its environment is renamed).
   */
  url?: string;
  /** Overrides the resolved token. Same fallback order as {@link CreateKVOptions.url}. */
  token?: string;
  /**
   * Environment to read from. Defaults to `process.env`. Accepting this makes
   * resolution testable and lets edge runtimes that expose bindings rather than
   * a global `process` pass their own object.
   */
  env?: Record<string, string | undefined>;
  /**
   * Permits a plaintext `http://` endpoint. The token is a bearer credential
   * sent on every request, so this is refused by default and should only be
   * enabled to reach a local development instance.
   */
  allowInsecureHttp?: boolean;
}

/** Redis client options callers may pass through, minus the ones we resolve. */
export type CapyKVClientOptions = Omit<RedisConfigNodejs, "url" | "token">;

function readEnv(
  env: Record<string, string | undefined>,
  names: readonly string[],
): { value: string; name: string } | undefined {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return { value, name };
  }
  return undefined;
}

/**
 * Resolves the K/V endpoint and token without constructing a client.
 *
 * Exported because configuration is the part worth testing and worth seeing:
 * a caller can assert their deployment is wired correctly, or build the
 * `@upstash/redis` client themselves and skip {@link createKv} entirely.
 *
 * @throws {CapyKVConfigError} when either value is missing, when the endpoint
 * is not a valid URL, or when it is plaintext HTTP and `allowInsecureHttp` is
 * not set.
 */
export function resolveKVCredentials(options: CreateKVOptions = {}): CapyKVCredentials {
  const env = options.env ?? (typeof process === "undefined" ? {} : process.env);

  const url = options.url?.trim() || readEnv(env, URL_ENV_VARS)?.value;
  if (!url) {
    throw new CapyKVConfigError(
      `No CapyDB K/V endpoint found. Set ${URL_ENV_VARS[0]} (or pass options.url). ` +
        `Get it from the K/V tab of your project, or run "capydb kv credentials".`,
    );
  }

  const token = options.token?.trim() || readEnv(env, TOKEN_ENV_VARS)?.value;
  if (!token) {
    throw new CapyKVConfigError(
      `No CapyDB K/V token found. Set ${TOKEN_ENV_VARS[0]} (or pass options.token). ` +
        `The token is shown once, when the store is created or its token is rotated - ` +
        `rotate it with "capydb kv rotate-token" if it was not saved.`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CapyKVConfigError(
      `CapyDB K/V endpoint is not a valid URL: ${url}. Expected https://<your-project>.db.capydb.dev`,
    );
  }
  if (parsed.protocol !== "https:" && !options.allowInsecureHttp) {
    throw new CapyKVConfigError(
      `Refusing to send the K/V token over ${parsed.protocol}//. The token is a bearer ` +
        `credential on every request. Use https://, or set allowInsecureHttp for a local instance.`,
    );
  }

  // @upstash/redis builds request paths by concatenation, so a trailing slash
  // produces a double slash in every URL it requests.
  return { url: url.replace(/\/+$/, ""), token };
}

/**
 * Builds an `@upstash/redis` client for a CapyDB K/V store.
 *
 * The returned client is a plain `Redis` instance - every method, and every
 * library that accepts one (notably `@upstash/ratelimit`), works unchanged.
 *
 * @throws {CapyKVConfigError} when configuration is missing or unusable.
 */
export function createKv(options: CreateKVOptions & CapyKVClientOptions = {}): Redis {
  const { url, token, env, allowInsecureHttp, ...clientOptions } = options;
  const credentials = resolveKVCredentials({ url, token, env, allowInsecureHttp });
  return new Redis({ ...clientOptions, url: credentials.url, token: credentials.token });
}

export { Redis };
export type { RedisConfigNodejs };
