---
name: viator-mcp
description: Search Viator tours, activities and experiences via MCP. Use when the user asks to find tours, activities, excursions, day trips, tickets, or "things to do" in a city or destination, get details/pricing/availability for a Viator product, list attractions in a destination, or convert supplier-currency prices. Triggers on phrases like "things to do in Rome", "find a food tour in Paris", "is this tour available in September", "Viator", "book an excursion" (search only — no booking), or "skip-the-line Colosseum tickets". Requires the @chrischall/viator-mcp package installed and the viator server registered (see Setup), plus a Viator Partner API key (free Basic Access affiliate tier).
---

# viator-mcp

MCP server for the **Viator Partner API** (v2, Basic Access affiliate tier) — search the
Viator catalog of 300k+ tours, activities and experiences, get product details, availability
schedules and pricing, browse attractions and destinations, all over stdio. Read-only: this
tier cannot make bookings; every product result carries a `productUrl` for booking on viator.com.

- **npm:** [npmjs.com/package/@chrischall/viator-mcp](https://www.npmjs.com/package/@chrischall/viator-mcp)
- **Source:** [github.com/chrischall/viator-mcp](https://github.com/chrischall/viator-mcp)

## Setup

### Option A — npx (recommended)

Add to `.mcp.json` in your project or `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "viator": {
      "command": "npx",
      "args": ["-y", "@chrischall/viator-mcp"],
      "env": {
        "VIATOR_API_KEY": "your-viator-partner-api-key"
      }
    }
  }
}
```

Get a key by signing up as a Viator affiliate at
[partnerresources.viator.com](https://partnerresources.viator.com/) — the Basic Access tier is free.

### Option B — from source

```bash
git clone https://github.com/chrischall/viator-mcp
cd viator-mcp
npm install && npm run build
```

Then point `.mcp.json` at `dist/index.js` with `VIATOR_API_KEY` in `env`.

## Workflow

1. **Find the destination id** — `vt_search_freetext` with `search_types: ["DESTINATIONS"]`
   (or `vt_list_destinations` for the full taxonomy).
2. **Search products** — `vt_search_products` with the destination id plus filters
   (price, dates, rating, duration, tags via `vt_list_product_tags`, flags like
   `FREE_CANCELLATION`). Use `compact: true` to keep results small while browsing.
3. **Drill in** — `vt_get_product` for full details; `vt_get_availability_schedule` for
   seasons/start times/pricing (supplier currency — convert with `vt_get_exchange_rates`).
4. **Attractions** — `vt_search_attractions` / `vt_get_attraction` for landmark-centric
   browsing; each attraction lists its mapped product codes.

## Tools

| Area | Tools |
| --- | --- |
| Products | `vt_search_products`, `vt_get_product`, `vt_list_product_tags` |
| Search | `vt_search_freetext` |
| Attractions | `vt_search_attractions`, `vt_get_attraction` |
| Availability | `vt_get_availability_schedule` |
| Reference | `vt_list_destinations`, `vt_get_locations`, `vt_get_exchange_rates` |

## Notes

- Prices from `vt_search_products`/`vt_search_freetext` are in the requested `currency`;
  prices from `vt_get_availability_schedule` are in the **supplier's** currency.
- Viator rate-limits per endpoint on a rolling 10s window; the server caches identical
  reads (`VIATOR_CACHE_TTL`, default 60s) and retries once honoring `Retry-After`.
- Booking URLs (`productUrl`, `attractionUrl`) must be used verbatim for affiliate
  attribution; pass `campaign_value` to tag them.
