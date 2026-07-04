import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestHarness } from '@chrischall/mcp-utils/test';
import { registerAttractionTools } from '../../src/tools/attractions.js';
import { client } from '../../src/client.js';

afterEach(() => vi.restoreAllMocks());

describe('attraction tools', () => {
  it('vt_search_attractions builds the documented body', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({ attractions: [], totalCount: 0 });
    const h = await createTestHarness(registerAttractionTools);
    await h.callTool('vt_search_attractions', { destination_id: 357, sort: 'REVIEW_AVG_RATING', count: 30 });
    const [path, body] = post.mock.calls[0];
    expect(path).toBe('/attractions/search');
    expect(body).toEqual({
      destinationId: 357,
      sorting: { sort: 'REVIEW_AVG_RATING' },
      pagination: { start: 1, count: 30 },
    });
    await h.close();
  });

  it('vt_search_attractions omits sorting when no sort given', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({ attractions: [], totalCount: 0 });
    const h = await createTestHarness(registerAttractionTools);
    await h.callTool('vt_search_attractions', { destination_id: 357 });
    expect(post.mock.calls[0][1]).toEqual({ destinationId: 357, pagination: { start: 1, count: 10 } });
    await h.close();
  });

  it('vt_get_attraction fetches by id', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ attractionId: 792 });
    const h = await createTestHarness(registerAttractionTools);
    await h.callTool('vt_get_attraction', { attraction_id: 792 });
    expect(get.mock.calls[0][0]).toBe('/attractions/792');
    await h.close();
  });
});
