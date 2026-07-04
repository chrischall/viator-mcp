import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { textResult } from '@chrischall/mcp-utils';
import { client } from '../client.js';
import {
  ProductCode,
  PRODUCT_SORTS,
  SORT_ORDERS,
  paginationParams,
  campaignParam,
  currencyParam,
  qs,
  prune,
  range,
  compactProductsEnvelope,
} from './shared.js';

export function registerProductTools(server: McpServer): void {
  server.registerTool(
    'vt_search_products',
    {
      description:
        'Search Viator tours, activities and experiences with structured filters (destination, tags, price, dates, rating, duration). Returns product summaries with pricing and booking URLs. Use vt_list_destinations to find destination ids and vt_list_product_tags for tag ids.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        destination: z.string().optional().describe('Destination id (from vt_list_destinations), e.g. "732" for Paris'),
        tags: z.array(z.number().int()).optional().describe('Tag ids products must match (from vt_list_product_tags)'),
        flags: z
          .array(z.string())
          .optional()
          .describe('Product flags, e.g. FREE_CANCELLATION, LIKELY_TO_SELL_OUT, PRIVATE_TOUR'),
        lowest_price: z.number().optional().describe('Minimum from-price (in currency)'),
        highest_price: z.number().optional().describe('Maximum from-price (in currency)'),
        start_date: z.string().optional().describe('Only products operating on/after this date (YYYY-MM-DD)'),
        end_date: z.string().optional().describe('Only products operating on/before this date (YYYY-MM-DD)'),
        min_rating: z.number().min(0).max(5).optional().describe('Minimum average traveler rating (0-5)'),
        max_rating: z.number().min(0).max(5).optional().describe('Maximum average traveler rating (0-5)'),
        min_duration_minutes: z.number().int().optional().describe('Minimum product duration in minutes'),
        max_duration_minutes: z.number().int().optional().describe('Maximum product duration in minutes'),
        sort: z.enum(PRODUCT_SORTS).optional().describe('Sort key (default: DEFAULT — Viator relevance)'),
        order: z.enum(SORT_ORDERS).optional().describe('Sort direction'),
        ...paginationParams,
        ...currencyParam,
        ...campaignParam,
        compact: z
          .boolean()
          .default(false)
          .describe('Return a slim summary per product (code, title, price, rating, URL) instead of full records'),
      },
    },
    async (args) => {
      const filtering = prune({
        destination: args.destination,
        tags: args.tags,
        flags: args.flags,
        lowestPrice: args.lowest_price,
        highestPrice: args.highest_price,
        startDate: args.start_date,
        endDate: args.end_date,
        rating: range(args.min_rating, args.max_rating),
        durationInMinutes: range(args.min_duration_minutes, args.max_duration_minutes),
      });
      const body = prune({
        filtering,
        sorting: args.sort ? prune({ sort: args.sort, order: args.order }) : undefined,
        pagination: { start: args.start, count: args.count },
        currency: args.currency,
      });
      const data = await client.post(`/products/search${qs({ 'campaign-value': args.campaign_value })}`, body);
      return textResult(args.compact ? compactProductsEnvelope(data) : data);
    },
  );

  server.registerTool(
    'vt_get_product',
    {
      description:
        'Get full details for one Viator product by product code — description, inclusions/exclusions, itinerary, product options, cancellation policy, booking URL, review summary.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        product_code: ProductCode.describe('Viator product code, e.g. 5010SYDNEY'),
        ...campaignParam,
      },
    },
    async ({ product_code, campaign_value }) => {
      const data = await client.get(`/products/${product_code}${qs({ 'campaign-value': campaign_value })}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'vt_list_product_tags',
    {
      description:
        'List all Viator product tags (tag id → names in every locale, with parent-tag hierarchy). Use tag ids to filter vt_search_products. Reference data — cached.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {},
    },
    async () => {
      const data = await client.get('/products/tags', { cache: 'static' });
      return textResult(data);
    },
  );
}
