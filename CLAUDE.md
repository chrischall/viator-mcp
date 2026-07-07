# CLAUDE.md — viator-mcp

Guidance for Claude working in this repo.

## TL;DR

**Viator Partner API** (v2) MCP server, **Basic Access affiliate tier** — read-only.
Wraps `https://api.viator.com/partner` and exposes 10 tools over stdio: product
search/details/tags, free-text search, attractions, availability schedules,
destinations, locations, exchange rates. No booking endpoints (that's the
Merchant/Full-access+Booking tier); product results carry an affiliate
`productUrl` for booking on viator.com.

Auth is a Viator Partner API key (`VIATOR_API_KEY`) sent in the **`exp-api-key`**
header — not `Authorization: Bearer`. Every call also needs
`Accept: application/json;version=2.0` (omitting it is a 400) and most need
`Accept-Language`. This is the bearer/direct-API archetype with a thin custom
client (`src/client.ts`) rather than `createApiClient`, because Viator's read
endpoints are mostly **POSTs** (cached by path+body) and 429/503 responses carry
`Retry-After` that the client honors (one retry, capped at 30s). No fetchproxy.

## Environment

```
VIATOR_API_KEY=<key>             # Required. Free Basic Access signup: partnerresources.viator.com
VIATOR_API_BASE_URL=<url>        # Optional. API host (default production; sandbox: https://api.sandbox.viator.com/partner)
VIATOR_LANGUAGE=<code>           # Optional. Accept-Language (default en-US)
VIATOR_CACHE_TTL=<secs>          # Optional. Read-cache TTL (default 60; 0 disables)
VIATOR_STATIC_CACHE_TTL=<secs>   # Optional. Reference-data cache TTL (default 3600; 0 disables)
```

`client.get/post(path, body?, { cache })` share an in-memory cache keyed by
method+path+body with two TTL tiers: **dynamic** (default 60s) for searches,
**static** (default 3600s) for reference data (destinations, tags, locations,
exchange rates — opted in per tool). Viator rate-limits per endpoint / per
partner id on a rolling 10s window, so the cache is the main defense against an
agent re-issuing the same search.

The config error is **deferred**: the server boots and lists tools without a
key; the error surfaces on the first tool call (`requireKey()`).

## Layout

- `src/client.ts` — ViatorClient (headers, cache, Retry-After retry, deferred config) + singleton
- `src/tools/*.ts` — `registerXxxTools(server)` per area; all read-only
- `src/tools/shared.ts` — zod atoms (ProductCode path-charset guard), currency/sort enums,
  pagination, `prune`/`range`, compact ProductSummary projection (drift-fallback to raw)
- `docs/VIATOR-API.md` — pinned API shapes, live-verified 2026-07-05 (sandbox, Basic Access key)
- `tests/` — vitest, network fully mocked; `server-boot.test.ts` spawns the real built artifacts

## Conventions

- TDD; tests never hit the network.
- ESM + NodeNext: relative imports end in `.js`.
- Version singleton in `src/version.ts` (`x-release-please-version`); never hand-bump —
  release-please owns versions across package.json/manifest.json/server.json/.claude-plugin.
- Never commit secrets; `.env` is gitignored.
- Compact projections key off documented fields only; on drift, warn to stderr and
  return the raw response (never an empty projection).
- Live verification: `node scripts/live-probe.mjs` probes all 10 endpoints through the built
  client. Sandbox keys need `VIATOR_API_BASE_URL=https://api.sandbox.viator.com/partner`;
  results and quirks (count clamping vs 400s) are recorded in docs/VIATOR-API.md.

## Pull requests & release notes

Branch + PR, even for solo work. The repo squash-merges and release-please parses the PR title, so it **MUST be a Conventional Commit** (`feat:`/`fix:`/…); apply one release-notes label per PR (`enhancement`, `bug`, `dependencies`, `documentation`, etc.).

**Exception for first-party dependency bumps.** When bumping a package we own (`@chrischall/mcp-utils`, `@chrischall/realty-core`, `@fetchproxy/server` — anything published from a chrischall-owned repo), label the PR `enhancement` or `bug` instead of `dependencies`, and use the matching Conventional-Commit prefix (`feat:` or `fix:`) instead of `chore:`/`build(deps):`. Those bumps deliver real product fixes or features through us, so they should drive a release-please version bump and show up under Features/Bug Fixes in the release notes — not get hidden under "Dependencies" (which doesn't trigger a release).
