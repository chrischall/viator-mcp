# viator-mcp

[![npm](https://img.shields.io/npm/v/@chrischall/viator-mcp)](https://www.npmjs.com/package/@chrischall/viator-mcp)

MCP server for the **Viator Partner API** (v2) — search tours, activities and experiences for Claude. Search the catalog with structured filters or free text, get product details and availability schedules, browse attractions and destinations, all over stdio.

> Developed and maintained by AI (Claude Code). Use at your own discretion.

## Quick start

```json
{
  "mcpServers": {
    "viator": {
      "command": "npx",
      "args": ["-y", "@chrischall/viator-mcp"],
      "env": { "VIATOR_API_KEY": "your-viator-partner-api-key" }
    }
  }
}
```

Get a key by signing up as a Viator affiliate at [partnerresources.viator.com](https://partnerresources.viator.com/) — the **Basic Access** tier is free. This server targets that tier: read-only search/content/availability; no booking endpoints (product results carry a `productUrl` for booking on viator.com, tagged with your affiliate id).

## Tools

| Area | Tools |
| --- | --- |
| Products | `vt_search_products`, `vt_get_product`, `vt_list_product_tags` |
| Search | `vt_search_freetext` |
| Attractions | `vt_search_attractions`, `vt_get_attraction` |
| Availability | `vt_get_availability_schedule` |
| Reference | `vt_list_destinations`, `vt_get_locations`, `vt_get_exchange_rates` |

All tools are read-only. `vt_search_products` and `vt_search_freetext` accept `compact: true` for slim summaries (code, title, price, rating, booking URL) instead of full records.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `VIATOR_API_KEY` | yes | Viator Partner API key (sent as `exp-api-key`) |
| `VIATOR_API_BASE_URL` | no | API host (default production; set `https://api.sandbox.viator.com/partner` for a sandbox key) |
| `VIATOR_LANGUAGE` | no | `Accept-Language` for response text (default `en-US`) |
| `VIATOR_CACHE_TTL` | no | Seconds to cache identical reads (default `60`; `0` disables) |
| `VIATOR_STATIC_CACHE_TTL` | no | Seconds to cache reference data — destinations, tags, locations, exchange rates (default `3600`) |

Viator rate-limits per endpoint on a rolling 10-second window and answers 429/503 with `Retry-After`; the client honors it (one retry) and the response cache absorbs repeated identical calls.

## Development

```bash
npm install
npm test          # vitest; no real network calls
npm run build     # tsc + esbuild bundle
```

The API surface this server is coded against is pinned in [docs/VIATOR-API.md](docs/VIATOR-API.md).

## License

MIT
