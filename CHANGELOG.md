# Changelog

All notable changes to `@capydb/kv` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `LICENSE` with the MIT license text (the package was already declared MIT); it now ships in the
  npm tarball.

### Changed

- Dev tooling: oxlint 1.86.0 (was 1.85.0) and oxfmt 0.71.0 (was 0.70.0); `packageManager` is
  `pnpm@11.28.2` (was `pnpm@11.28.0`). No runtime change.
- Dev tooling: vitest 5.0.3 (was 5.0.2), lefthook 2.1.15 (was 2.1.14) and `typescript@next`
  7.1.0-dev.20260930.4 (was 7.1.0-dev.20260929.1). No runtime change.

## [2.0.2] - 2026-09-26

### Fixed

- The README and the module documentation said CapyDB's deployment integrations set both `CAPYKV_REST_URL` and `CAPYKV_REST_TOKEN`. The integrations set only `CAPYKV_REST_URL`. You must set `CAPYKV_REST_TOKEN` yourself because CapyDB stores only a hash of the token and cannot supply it. ([c912f64](https://github.com/capydatabase/capydb-kv/commit/c912f64))

## [2.0.1] - 2026-09-26

### Changed

- `packageManager` is `pnpm@11.28.0` (was `pnpm@12.4.2`), matching the other CapyDB JS repos; the
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

[Unreleased]: https://github.com/capydatabase/capydb-kv/compare/v2.0.2...HEAD
[2.0.2]: https://github.com/capydatabase/capydb-kv/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/capydatabase/capydb-kv/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/capydatabase/capydb-kv/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/capydatabase/capydb-kv/releases/tag/v1.0.0
