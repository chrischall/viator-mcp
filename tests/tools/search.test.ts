import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestHarness, parseToolResult } from '@chrischall/mcp-utils/test';
import { registerSearchTools } from '../../src/tools/search.js';
import { client } from '../../src/client.js';

afterEach(() => vi.restoreAllMocks());

describe('freetext search tool', () => {
  it('builds per-type searchTypes with pagination', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({ products: { totalCount: 0, results: [] } });
    const h = await createTestHarness(registerSearchTools);
    await h.callTool('vt_search_freetext', {
      search_term: 'colosseum',
      search_types: ['PRODUCTS', 'DESTINATIONS'],
      count: 5,
    });
    const [path, body] = post.mock.calls[0];
    expect(path).toBe('/search/freetext');
    expect(body).toEqual({
      searchTerm: 'colosseum',
      searchTypes: [
        { searchType: 'PRODUCTS', pagination: { start: 1, count: 5 } },
        { searchType: 'DESTINATIONS', pagination: { start: 1, count: 5 } },
      ],
      currency: 'USD',
    });
    await h.close();
  });

  it('includes productFiltering only when a product filter is set', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({});
    const h = await createTestHarness(registerSearchTools);
    await h.callTool('vt_search_freetext', {
      search_term: 'rome food',
      destination: '511',
      min_price: 20,
      max_price: 150,
      min_rating: 4,
      start_date: '2026-09-01',
      end_date: '2026-09-15',
      sort: 'PRICE',
      order: 'ASCENDING',
    });
    const [, body] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.productFiltering).toEqual({
      destination: '511',
      price: { from: 20, to: 150 },
      rating: { from: 4 },
      dateRange: { from: '2026-09-01', to: '2026-09-15' },
    });
    expect(body.productSorting).toEqual({ sort: 'PRICE', order: 'ASCENDING' });
    await h.close();
  });

  it('compact=true projects product results and leaves other blocks intact', async () => {
    vi.spyOn(client, 'post').mockResolvedValue({
      products: {
        totalCount: 1,
        results: [
          {
            productCode: 'X1',
            title: 'T',
            pricing: { summary: { fromPrice: 9 }, currency: 'USD' },
            reviews: { totalReviews: 3, combinedAverageRating: 5 },
          },
        ],
      },
      destinations: { totalCount: 1, results: [{ id: 511, name: 'Rome' }] },
    });
    const h = await createTestHarness(registerSearchTools);
    const res = await h.callTool('vt_search_freetext', { search_term: 'rome', compact: true });
    const data = parseToolResult<{
      products: { results: Record<string, unknown>[] };
      destinations: { results: unknown[] };
    }>(res);
    expect(data.products.results[0]).toEqual({
      productCode: 'X1',
      title: 'T',
      fromPrice: 9,
      currency: 'USD',
      rating: 5,
      reviewCount: 3,
    });
    expect(data.destinations.results).toEqual([{ id: 511, name: 'Rome' }]);
    await h.close();
  });
});
