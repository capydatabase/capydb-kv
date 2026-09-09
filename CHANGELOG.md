# Changelog

All notable changes to `@capydb/kv` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
