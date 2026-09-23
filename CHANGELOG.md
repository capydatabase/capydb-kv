# Changelog

All notable changes to `@capydb/kv` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `packageManager` is `pnpm@12.5.1` (was `pnpm@12.4.2`), matching the other CapyDB JS repos; the
  lockfile records the same pnpm version.

### Fixed

- README and the module doc comment said the deployment integrations push both `CAPYKV_REST_URL`
  and `CAPYKV_REST_TOKEN`. They push the URL only - the control plane stores just the token's
  hash - so the token is yours to set, as the README's own env section already said. A test
  comment still named the retired `CAPYDB_KV_*` variables; it now says `CAPYKV_*`.

## [2.0.0] - 2026-09-16

### Changed

- **BREAKING: the environment variables are now `CAPYKV_REST_URL` and `CAPYKV_REST_TOKEN`**
  (were `CAPYDB_KV_REST_URL` / `CAPYDB_KV_REST_TOKEN`). `createKv()` and `resolveKVCredentials()`
  read the new names and no longer recognise the old ones; the `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` fallback is unchanged. Rename the two variables wherever your app
  runs and nothing else changes. The README's RESP section now names `CAPYKV_REDIS_URL` and passes
  `tls: { servername }` to ioredis, which the K/V endpoint requires because it routes by TLS
  server name.

## [1.0.0] - 2026-09-09

### Added

- Initial release. `createKv()` builds an `@upstash/redis` client from
  `CAPYDB_KV_REST_URL` / `CAPYDB_KV_REST_TOKEN`, falling back to the `UPSTASH_*`
  names so an app migrating from Upstash keeps working before its environment is
  renamed.
- `resolveKVCredentials()` exposes the same resolution without building a
  client, so a deployment can assert it is wired correctly.
- `CapyKVConfigError` is thrown for missing, malformed or insecure
  configuration. This is the package's main reason to exist alongside plain
  `@upstash/redis`: `new Redis({})` with an absent url or token does not throw,
  it warns and then fails later at request time, which turns a missing
  environment variable into a confusing runtime error instead of an obvious
  startup one.
- Plaintext `http://` endpoints are refused unless `allowInsecureHttp` is set —
  the token is a bearer credential sent on every request.
