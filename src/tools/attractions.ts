import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { textResult } from '@chrischall/mcp-utils';
import { client } from '../client.js';
import { AttractionId, campaignParam, qs, prune } from './shared.js';

/** Sort keys documented for attraction search (live-verify pending). */
const ATTRACTION_SORTS = ['DEFAULT', 'ALPHABETICAL', 'REVIEW_AVG_RATING'] as const;

export function registerAttractionTools(server: McpServer): void {
  server.registerTool(
    'vt_search_attractions',
    {
      description:
        'List attractions (landmarks, museums, points of interest) in a Viator destination, including the product codes mapped to each attraction. Use vt_list_destinations to find destination ids.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        destination_id: z.number().int().positive().describe('Destination id (from vt_list_destinations)'),
        sort: z.enum(ATTRACTION_SORTS).optional().describe('Sort key (default: DEFAULT)'),
        start: z.number().int().min(1).default(1).describe('1-based index of the first result'),
        count: z.number().int().min(1).max(30).default(10).describe('Results per page (max 30; default 10)'),
        ...campaignParam,
      },
    },
    async ({ destination_id, sort, start, count, campaign_value }) => {
      const body = prune({
        destinationId: destination_id,
        sorting: sort ? { sort } : undefined,
        pagination: { start, count },
      });
      const data = await client.post(`/attractions/search${qs({ 'campaign-value': campaign_value })}`, body);
      return textResult(data);
    },
  );

  server.registerTool(
    'vt_get_attraction',
    {
      description:
        'Get details for one Viator attraction by id — name, destination, opening hours, review summary, mapped product codes, and the attraction URL.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        attraction_id: AttractionId.describe('Viator attraction id'),
        ...campaignParam,
      },
    },
    async ({ attraction_id, campaign_value }) => {
      const data = await client.get(`/attractions/${attraction_id}${qs({ 'campaign-value': campaign_value })}`);
      return textResult(data);
    },
  );
}
