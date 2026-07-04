import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { textResult } from '@chrischall/mcp-utils';
import { client } from '../client.js';
import { CURRENCIES, campaignParam, qs, prune } from './shared.js';

export function registerReferenceTools(server: McpServer): void {
  server.registerTool(
    'vt_list_destinations',
    {
      description:
        'List every Viator destination (cities, regions, countries) with ids, parent hierarchy, IATA codes, time zones, and coordinates. Use the destinationId with vt_search_products / vt_search_attractions. Reference data — cached.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: { ...campaignParam },
    },
    async ({ campaign_value }) => {
      const data = await client.get(`/destinations${qs({ 'campaign-value': campaign_value })}`, {
        cache: 'static',
      });
      return textResult(data);
    },
  );

  server.registerTool(
    'vt_get_locations',
    {
      description:
        'Resolve Viator location references (e.g. "LOC-...", meeting points, pickup points from product details) to names, addresses, and coordinates. Up to 500 references per call. Reference data — cached.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        location_refs: z
          .array(z.string().min(1))
          .min(1)
          .max(500)
          .describe('Location reference ids from product content (max 500)'),
      },
    },
    async ({ location_refs }) => {
      const data = await client.post('/locations/bulk', { locations: location_refs }, { cache: 'static' });
      return textResult(data);
    },
  );

  server.registerTool(
    'vt_get_exchange_rates',
    {
      description:
        'Get exchange rates between currencies Viator supports — needed to convert supplier-currency prices from vt_get_availability_schedule. Reference data — cached.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        source_currencies: z.array(z.enum(CURRENCIES)).optional().describe('Source currency codes (e.g. ["EUR"])'),
        target_currencies: z.array(z.enum(CURRENCIES)).optional().describe('Target currency codes (e.g. ["USD"])'),
      },
    },
    async ({ source_currencies, target_currencies }) => {
      const body = prune({ sourceCurrencies: source_currencies, targetCurrencies: target_currencies });
      const data = await client.post('/exchange-rates', body, { cache: 'static' });
      return textResult(data);
    },
  );
}
