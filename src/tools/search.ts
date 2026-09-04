import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { viewArg, viewResponse } from '../view.js';
import { client } from '../client.js';
import {
  PRODUCT_SORTS,
  SORT_ORDERS,
  campaignParam,
  currencyParam,
  qs,
  prune,
  range,
  compactFreetextEnvelope,
  COMPACT_PRODUCT_FIELDS,
} from './shared.js';

const SEARCH_TYPES = ['PRODUCTS', 'ATTRACTIONS', 'DESTINATIONS'] as const;

/**
 * This tool's compact rung projects one block and media-strips the others, so
 * its note says so rather than borrowing the media-only note the other tools use.
 */
const FREETEXT_VIEW_NOTE =
  `compact (default) projects the PRODUCT results down to their ${COMPACT_PRODUCT_FIELDS} ` +
  'and strips image/avatar URLs from the attraction and destination results; ' +
  '"full" returns Viator\'s payload untouched.';

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    'vt_search_freetext',
    {
      description:
        'Free-text search across Viator products, attractions, and destinations (e.g. "colosseum underground tour"). The fastest way to find things when you don\'t have a destination id yet.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        view: viewArg(FREETEXT_VIEW_NOTE),
        search_term: z.string().min(1).describe('Free-text search term'),
        search_types: z
          .array(z.enum(SEARCH_TYPES))
          .min(1)
          .default(['PRODUCTS'])
          .describe('Which result types to return (default: PRODUCTS only)'),
        destination: z.string().optional().describe('Restrict product results to a destination id'),
        min_price: z.number().optional().describe('Minimum product from-price (in currency)'),
        max_price: z.number().optional().describe('Maximum product from-price (in currency)'),
        min_rating: z.number().min(0).max(5).optional().describe('Minimum average traveler rating (0-5)'),
        start_date: z.string().optional().describe('Only products operating on/after this date (YYYY-MM-DD)'),
        end_date: z.string().optional().describe('Only products operating on/before this date (YYYY-MM-DD)'),
        sort: z.enum(PRODUCT_SORTS).optional().describe('Product sort key'),
        order: z.enum(SORT_ORDERS).optional().describe('Sort direction'),
        start: z.number().int().min(1).default(1).describe('1-based index of the first result (per type)'),
        count: z.number().int().min(1).max(50).default(10).describe('Results per page per type (max 50; default 10)'),
        ...currencyParam,
        ...campaignParam,
      },
    },
    async (args) => {
      const productFiltering = prune({
        destination: args.destination,
        price: range(args.min_price, args.max_price),
        rating: range(args.min_rating, undefined),
        dateRange:
          args.start_date === undefined && args.end_date === undefined
            ? undefined
            : prune({ from: args.start_date, to: args.end_date }),
      });
      const body = prune({
        searchTerm: args.search_term,
        searchTypes: args.search_types.map((t) => ({ searchType: t, pagination: { start: args.start, count: args.count } })),
        productFiltering: Object.keys(productFiltering).length ? productFiltering : undefined,
        productSorting: args.sort ? prune({ sort: args.sort, order: args.order }) : undefined,
        currency: args.currency,
      });
      const data = await client.post(`/search/freetext${qs({ 'campaign-value': args.campaign_value })}`, body);
      return viewResponse(args.view, data, compactFreetextEnvelope);
    },
  );
}
