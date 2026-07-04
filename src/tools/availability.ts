import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { textResult } from '@chrischall/mcp-utils';
import { client } from '../client.js';
import { ProductCode } from './shared.js';

export function registerAvailabilityTools(server: McpServer): void {
  server.registerTool(
    'vt_get_availability_schedule',
    {
      description:
        'Get the availability schedule and pricing for a Viator product — seasons, days of week, start times, unavailable dates, and per-age-band pricing for every product option. NOTE: prices are in the SUPPLIER\'s currency (see the currency field); convert with vt_get_exchange_rates.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        product_code: ProductCode.describe('Viator product code, e.g. 5010SYDNEY'),
      },
    },
    async ({ product_code }) => {
      const data = await client.get(`/availability/schedules/${product_code}`);
      return textResult(data);
    },
  );
}
