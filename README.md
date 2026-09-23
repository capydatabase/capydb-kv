# @capydb/kv

Helpers for **CapyDB Knight/Valkyrie** (K/V) — the key-value and rate-limiting
store that runs beside your cell, on the same node. Powered by Valkey ·
Redis®-compatible.

## You might not need this

CapyDB K/V speaks the same HTTP protocol `@upstash/redis` already speaks, so it
works with no dependency on us at all:

```ts
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.CAPYKV_REST_URL!,
  token: process.env.CAPYKV_REST_TOKEN!,
})
```

That is genuinely all it takes, and it is the recommended starting point. This
package exists for two narrow reasons:

1. **It reads CapyDB's environment variables.** `Redis.fromEnv()` looks for
   `UPSTASH_REDIS_REST_URL` / `_TOKEN`; CapyDB uses `CAPYKV_REST_URL` /
   `CAPYKV_REST_TOKEN` (the deployment integrations push the URL, and you set
   the token), so `fromEnv()` finds nothing.
2. **It fails fast on missing configuration.** `new Redis({})` with an absent
   url or token does not throw — it only logs a warning and then fails later, at
   request time, from wherever the first command happens to run. A deploy
   missing an env var should break at startup with a message naming the
   variable.

## Install

`@upstash/redis` is a peer dependency:

```bash
pnpm add @capydb/kv @upstash/redis
```

## Quickstart

```bash
capydb link
capydb kv create --write-env   # provisions the store, writes both variables to your env file
                               # (without --write-env it prints the token instead - once)
```

```ts
import { createKv } from "@capydb/kv"

const kv = createKv()

await kv.set("greeting", "hello")
await kv.get("greeting")     // "hello"
await kv.incr("visits")      // 1
```

The returned value is a plain `@upstash/redis` client — every method works, and
so does every library that accepts one.

## Rate limiting

Nothing extra is needed. Pass the client to `@upstash/ratelimit`:

```bash
pnpm add @upstash/ratelimit
```

```ts
import { Ratelimit } from "@upstash/ratelimit"
import { createKv } from "@capydb/kv"

const ratelimit = new Ratelimit({
  redis: createKv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
})

const { success, remaining, reset } = await ratelimit.limit(userId)
if (!success) return new Response("Rate limit exceeded", { status: 429 })
```

Sliding window, fixed window and token bucket all work.

## API

### `createKv(options?)`

Returns a configured `@upstash/redis` client. Throws `CapyKVConfigError` when
the endpoint or token is missing or unusable.

| Option | Default | Notes |
|---|---|---|
| `url` | `CAPYKV_REST_URL`, then `UPSTASH_REDIS_REST_URL` | The Upstash fallback keeps a migrating app working before its env is renamed |
| `token` | `CAPYKV_REST_TOKEN`, then `UPSTASH_REDIS_REST_TOKEN` | |
| `env` | `process.env` | Pass your own for tests, or for runtimes with no global `process` |
| `allowInsecureHttp` | `false` | The token is a bearer credential on every request, so plaintext `http://` is refused unless you opt in for a local instance |

Any other option is forwarded to the `@upstash/redis` constructor.

### `resolveKVCredentials(options?)`

Resolves `{ url, token }` without building a client — useful for asserting a
deployment is wired correctly, or for constructing the client yourself.

### `CapyKVConfigError`

Thrown for missing, malformed, or insecure configuration.

## Connecting without HTTP

The REST endpoint cannot express blocking commands or pub/sub, so job queues
(BullMQ, Celery, Sidekiq) need the RESP endpoint instead. Any Redis client works, pointed at
`CAPYKV_REDIS_URL` (`rediss://default:<token>@<host>:6379`), which
`capydb kv create --write-env` writes next to the REST pair:

```ts
import Redis from "ioredis"
const url = process.env.CAPYKV_REDIS_URL!
const redis = new Redis(url, { tls: { servername: new URL(url).hostname } })
```

The `servername` is not optional: the endpoint routes by TLS server name, and
Node's `tls.connect` sends none unless told to, so a bare `new Redis(url)` is
refused. `redis-cli` needs `--sni <host>` for the same reason; redis-py and
go-redis send it on their own.

```bash
capydb kv credentials    # prints the host and a password-free rediss:// URL
```

`capydb kv credentials` cannot fill in the password: only the token's hash is
stored, so it is never returned again after create or rotate. The RESP URL is
built from the token you saved then.

The deployment integrations (Vercel, Netlify, Cloudflare) push
`CAPYKV_REST_URL` only, for the same reason — set `CAPYKV_REST_TOKEN`
yourself wherever your app runs. `capydb env pull` likewise refreshes the URL
and leaves the token alone.

## Notes

- **Durability.** K/V snapshots to disk and survives a restart. There are no
  backups and no point-in-time recovery — treat it as a cache and a coordination
  store, not a system of record.
- **No scale-to-zero.** Unlike a database cell, a K/V store is always warm; a
  rate limiter cannot absorb a resume on the first request after an idle period.
- **Rotation is immediate.** `capydb kv rotate-token` invalidates the previous
  token with no grace window, so roll it out to your clients first.

## License

MIT

---

Redis is a registered trademark of Redis Ltd. Valkey is a trademark of LF
Projects, LLC. Any rights therein are reserved to their respective owners. Use
of these marks is for referential purposes only and does not indicate
sponsorship or endorsement.
