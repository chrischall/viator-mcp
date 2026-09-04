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

  it('compact — the DEFAULT — projects product results and leaves other blocks intact', async () => {
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
    const res = await h.callTool('vt_search_freetext', { search_term: 'rome' });
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

  it('media-strips the blocks it has no projection for, and does NOT re-strip the projected one', async () => {
    // compactProduct keeps coverImageUrl on purpose — a decision made WITH
    // knowledge of the API. The attraction block has no projection speaking for
    // it, so it gets the subtractive rule every un-projected payload gets.
    vi.spyOn(client, 'post').mockResolvedValue({
      products: {
        totalCount: 1,
        results: [{ productCode: 'X1', images: [{ isCover: true, variants: [{ width: 480, url: 'https://img/480.jpg' }] }] }],
      },
      attractions: { totalCount: 1, results: [{ id: 9, name: 'Colosseum', images: ['https://cdn/a.jpg'] }] },
    });
    const h = await createTestHarness(registerSearchTools);
    const res = await h.callTool('vt_search_freetext', { search_term: 'rome' });
    const data = parseToolResult<{
      products: { results: Record<string, unknown>[] };
      attractions: { results: Record<string, unknown>[] };
    }>(res);
    expect(data.products.results[0]).toEqual({ productCode: 'X1', coverImageUrl: 'https://img/480.jpg' });
    expect(data.attractions.results[0]).toEqual({ id: 9, name: 'Colosseum' });
    await h.close();
  });

  it('media-strips rather than projecting when the products block drifts', async () => {
    vi.spyOn(client, 'post').mockResolvedValue({ unexpected: 'shape', avatar: 'https://cdn/a.png' });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const h = await createTestHarness(registerSearchTools);
    const res = await h.callTool('vt_search_freetext', { search_term: 'rome' });
    expect(parseToolResult<Record<string, unknown>>(res)).toEqual({ unexpected: 'shape' });
    expect(errSpy).toHaveBeenCalled();
    await h.close();
  });

  it('view:full returns Viator\'s payload untouched — no projection, no stripping', async () => {
    const payload = {
      products: { totalCount: 1, results: [{ productCode: 'X1', description: 'long', images: [{ isCover: true }] }] },
    };
    vi.spyOn(client, 'post').mockResolvedValue(payload);
    const h = await createTestHarness(registerSearchTools);
    const res = await h.callTool('vt_search_freetext', { search_term: 'rome', view: 'full' });
    expect(parseToolResult<typeof payload>(res)).toEqual(payload);
    await h.close();
  });
});
