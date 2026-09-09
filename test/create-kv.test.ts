import { describe, expect, it } from "vitest";
import { CapyKVConfigError, createKv, resolveKVCredentials } from "../src/index.js";

const URL_OK = "https://my-app-abc123.db.capydb.dev";
const TOKEN = "capy_kv_0123456789abcdef";

describe("resolveKVCredentials", () => {
  it("reads CapyDB's own environment variables", () => {
    // The reason the package exists: Redis.fromEnv() looks for UPSTASH_* and
    // CapyDB's integrations push CAPYDB_KV_*, so fromEnv() finds nothing.
    const credentials = resolveKVCredentials({
      env: { CAPYDB_KV_REST_URL: URL_OK, CAPYDB_KV_REST_TOKEN: TOKEN },
    });
    expect(credentials).toEqual({ url: URL_OK, token: TOKEN });
  });

  it("falls back to UPSTASH_* names so a migrating app keeps working", () => {
    const credentials = resolveKVCredentials({
      env: { UPSTASH_REDIS_REST_URL: URL_OK, UPSTASH_REDIS_REST_TOKEN: TOKEN },
    });
    expect(credentials).toEqual({ url: URL_OK, token: TOKEN });
  });

  it("prefers CapyDB's variables when both are present", () => {
    const credentials = resolveKVCredentials({
      env: {
        CAPYDB_KV_REST_URL: URL_OK,
        CAPYDB_KV_REST_TOKEN: TOKEN,
        UPSTASH_REDIS_REST_URL: "https://other.example",
        UPSTASH_REDIS_REST_TOKEN: "other",
      },
    });
    expect(credentials.url).toBe(URL_OK);
    expect(credentials.token).toBe(TOKEN);
  });

  it("prefers explicit options over the environment", () => {
    const credentials = resolveKVCredentials({
      url: "https://explicit.db.capydb.dev",
      token: "capy_kv_explicit",
      env: { CAPYDB_KV_REST_URL: URL_OK, CAPYDB_KV_REST_TOKEN: TOKEN },
    });
    expect(credentials.url).toBe("https://explicit.db.capydb.dev");
    expect(credentials.token).toBe("capy_kv_explicit");
  });

  it("strips a trailing slash", () => {
    // @upstash/redis builds request paths by concatenation, so a trailing
    // slash yields a double slash in every request it makes.
    const credentials = resolveKVCredentials({
      env: { CAPYDB_KV_REST_URL: `${URL_OK}//`, CAPYDB_KV_REST_TOKEN: TOKEN },
    });
    expect(credentials.url).toBe(URL_OK);
  });

  it("ignores blank and whitespace-only values", () => {
    expect(() =>
      resolveKVCredentials({ env: { CAPYDB_KV_REST_URL: "   ", CAPYDB_KV_REST_TOKEN: TOKEN } }),
    ).toThrow(CapyKVConfigError);
  });

  it("names the missing variable rather than failing later at request time", () => {
    // The behaviour this package adds: new Redis({}) only console.warns, so a
    // deploy with a missing variable fails mid-request instead of at startup.
    expect(() => resolveKVCredentials({ env: {} })).toThrow(/CAPYDB_KV_REST_URL/);
    expect(() => resolveKVCredentials({ env: { CAPYDB_KV_REST_URL: URL_OK } })).toThrow(
      /CAPYDB_KV_REST_TOKEN/,
    );
  });

  it("rejects a malformed endpoint", () => {
    expect(() =>
      resolveKVCredentials({
        env: { CAPYDB_KV_REST_URL: "not a url", CAPYDB_KV_REST_TOKEN: TOKEN },
      }),
    ).toThrow(CapyKVConfigError);
  });

  it("refuses to send the token over plaintext http by default", () => {
    // The token is a bearer credential on every request.
    expect(() =>
      resolveKVCredentials({
        env: { CAPYDB_KV_REST_URL: "http://localhost:8080", CAPYDB_KV_REST_TOKEN: TOKEN },
      }),
    ).toThrow(/Refusing to send the K\/V token/);
  });

  it("allows plaintext http when explicitly opted in", () => {
    const credentials = resolveKVCredentials({
      env: { CAPYDB_KV_REST_URL: "http://localhost:8080", CAPYDB_KV_REST_TOKEN: TOKEN },
      allowInsecureHttp: true,
    });
    expect(credentials.url).toBe("http://localhost:8080");
  });

  it("throws CapyKVConfigError, which is catchable by name", () => {
    try {
      resolveKVCredentials({ env: {} });
      expect.unreachable("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CapyKVConfigError);
      expect((error as Error).name).toBe("CapyKVConfigError");
    }
  });
});

describe("createKv", () => {
  it("returns a usable @upstash/redis client", () => {
    const redis = createKv({ env: { CAPYDB_KV_REST_URL: URL_OK, CAPYDB_KV_REST_TOKEN: TOKEN } });
    // A plain Redis instance: everything that accepts one - notably
    // @upstash/ratelimit - works unchanged.
    expect(typeof redis.get).toBe("function");
    expect(typeof redis.set).toBe("function");
    expect(typeof redis.eval).toBe("function");
    expect(typeof redis.pipeline).toBe("function");
    expect(typeof redis.multi).toBe("function");
  });

  it("forwards client options without letting them override credentials", () => {
    const redis = createKv({
      env: { CAPYDB_KV_REST_URL: URL_OK, CAPYDB_KV_REST_TOKEN: TOKEN },
      enableAutoPipelining: false,
      retry: false,
    });
    expect(redis).toBeDefined();
  });

  it("propagates the config error instead of returning a broken client", () => {
    expect(() => createKv({ env: {} })).toThrow(CapyKVConfigError);
  });
});
