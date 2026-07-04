import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { textResult } from '@chrischall/mcp-utils';
import { client } from '../client.js';
import {
  PRODUCT_SORTS,
  SORT_ORDERS,
  campaignParam,
  currencyParam,
  qs,
  prune,
  range,
  compactProduct,
} from './shared.js';

const SEARCH_TYPES = ['PRODUCTS', 'ATTRACTIONS', 'DESTINATIONS'] as const;

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    'vt_search_freetext',
    {
      description:
        'Free-text search across Viator products, attractions, and destinations (e.g. "colosseum underground tour"). The fastest way to find things when you don\'t have a destination id yet.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
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
        compact: z
          .boolean()
          .default(false)
          .describe('Return slim product summaries instead of full records'),
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
      if (!args.compact) return textResult(data);
      const d = data as { products?: { totalCount?: number; results?: unknown[] } };
      if (!Array.isArray(d?.products?.results)) return textResult(data);
      return textResult({
        ...d,
        products: { totalCount: d.products.totalCount, results: d.products.results.map(compactProduct) },
      });
    },
  );
}
