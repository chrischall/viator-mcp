import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestHarness, parseToolResult } from '@chrischall/mcp-utils/test';
import { registerProductTools } from '../../src/tools/products.js';
import { client } from '../../src/client.js';

afterEach(() => vi.restoreAllMocks());

describe('product tools', () => {
  it('vt_search_products builds the documented body shape', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({ products: [], totalCount: 0 });
    const h = await createTestHarness(registerProductTools);
    await h.callTool('vt_search_products', {
      destination: '732',
      tags: [21972],
      flags: ['FREE_CANCELLATION'],
      lowest_price: 10,
      highest_price: 200,
      start_date: '2026-08-01',
      end_date: '2026-08-31',
      min_rating: 4,
      min_duration_minutes: 60,
      max_duration_minutes: 480,
      sort: 'TRAVELER_RATING',
      order: 'DESCENDING',
      start: 1,
      count: 20,
      currency: 'EUR',
    });
    const [path, body] = post.mock.calls[0];
    expect(path).toBe('/products/search');
    expect(body).toEqual({
      filtering: {
        destination: '732',
        tags: [21972],
        flags: ['FREE_CANCELLATION'],
        lowestPrice: 10,
        highestPrice: 200,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        rating: { from: 4 },
        durationInMinutes: { from: 60, to: 480 },
      },
      sorting: { sort: 'TRAVELER_RATING', order: 'DESCENDING' },
      pagination: { start: 1, count: 20 },
      currency: 'EUR',
    });
    await h.close();
  });

  it('vt_search_products omits unset filters and defaults currency/pagination', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({ products: [], totalCount: 0 });
    const h = await createTestHarness(registerProductTools);
    await h.callTool('vt_search_products', { destination: '357' });
    const [, body] = post.mock.calls[0];
    expect(body).toEqual({
      filtering: { destination: '357' },
      pagination: { start: 1, count: 10 },
      currency: 'USD',
    });
    await h.close();
  });

  it('vt_search_products appends campaign-value as a query param', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({ products: [], totalCount: 0 });
    const h = await createTestHarness(registerProductTools);
    await h.callTool('vt_search_products', { destination: '1', campaign_value: 'summer-blog' });
    expect(post.mock.calls[0][0]).toBe('/products/search?campaign-value=summer-blog');
    await h.close();
  });

  it('vt_search_products compact=true projects slim summaries', async () => {
    vi.spyOn(client, 'post').mockResolvedValue({
      totalCount: 1,
      products: [
        {
          productCode: '5010SYDNEY',
          title: 'Sydney Harbour Cruise',
          description: 'long text…',
          pricing: { summary: { fromPrice: 45.5 }, currency: 'USD' },
          reviews: { totalReviews: 1200, combinedAverageRating: 4.6 },
          duration: { fixedDurationInMinutes: 90 },
          confirmationType: 'INSTANT',
          flags: ['FREE_CANCELLATION'],
          productUrl: 'https://www.viator.com/tours/x?pid=P00',
          images: [
            {
              isCover: true,
              variants: [
                { width: 100, height: 66, url: 'https://img/100.jpg' },
                { width: 480, height: 320, url: 'https://img/480.jpg' },
                { width: 1280, height: 853, url: 'https://img/1280.jpg' },
              ],
            },
          ],
        },
      ],
    });
    const h = await createTestHarness(registerProductTools);
    const res = await h.callTool('vt_search_products', { destination: '357', compact: true });
    const data = parseToolResult<{ totalCount: number; products: Record<string, unknown>[] }>(res);
    expect(data.totalCount).toBe(1);
    expect(data.products[0]).toEqual({
      productCode: '5010SYDNEY',
      title: 'Sydney Harbour Cruise',
      fromPrice: 45.5,
      currency: 'USD',
      rating: 4.6,
      reviewCount: 1200,
      durationMinutes: 90,
      confirmationType: 'INSTANT',
      flags: ['FREE_CANCELLATION'],
      productUrl: 'https://www.viator.com/tours/x?pid=P00',
      coverImageUrl: 'https://img/480.jpg',
    });
    await h.close();
  });

  it('vt_search_products compact=true falls back to the raw response on drift', async () => {
    vi.spyOn(client, 'post').mockResolvedValue({ unexpected: 'shape' });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const h = await createTestHarness(registerProductTools);
    const res = await h.callTool('vt_search_products', { destination: '357', compact: true });
    const data = parseToolResult<Record<string, unknown>>(res);
    expect(data).toEqual({ unexpected: 'shape' });
    expect(errSpy).toHaveBeenCalled();
    await h.close();
  });

  it('vt_get_product fetches by product code with campaign-value', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ productCode: '5010SYDNEY' });
    const h = await createTestHarness(registerProductTools);
    await h.callTool('vt_get_product', { product_code: '5010SYDNEY', campaign_value: 'x' });
    expect(get.mock.calls[0][0]).toBe('/products/5010SYDNEY?campaign-value=x');
    await h.close();
  });

  it('vt_get_product rejects a path-escaping product code', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerProductTools);
    const res = await h.callTool('vt_get_product', { product_code: '../bookings' });
    expect(res.isError).toBe(true);
    expect(get).not.toHaveBeenCalled();
    await h.close();
  });

  it('vt_list_product_tags uses the static cache tier', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ tags: [] });
    const h = await createTestHarness(registerProductTools);
    await h.callTool('vt_list_product_tags', {});
    expect(get).toHaveBeenCalledWith('/products/tags', { cache: 'static' });
    await h.close();
  });
});
