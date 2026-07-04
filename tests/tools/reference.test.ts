import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestHarness } from '@chrischall/mcp-utils/test';
import { registerReferenceTools } from '../../src/tools/reference.js';
import { client } from '../../src/client.js';

afterEach(() => vi.restoreAllMocks());

describe('reference tools', () => {
  it('vt_list_destinations uses the static cache tier', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ destinations: [], totalCount: 0 });
    const h = await createTestHarness(registerReferenceTools);
    await h.callTool('vt_list_destinations', {});
    expect(get).toHaveBeenCalledWith('/destinations', { cache: 'static' });
    await h.close();
  });

  it('vt_get_locations posts the refs as { locations }', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({ locations: [] });
    const h = await createTestHarness(registerReferenceTools);
    await h.callTool('vt_get_locations', { location_refs: ['LOC-abc', 'MEET_AT_DEPARTURE_POINT'] });
    expect(post).toHaveBeenCalledWith(
      '/locations/bulk',
      { locations: ['LOC-abc', 'MEET_AT_DEPARTURE_POINT'] },
      { cache: 'static' },
    );
    await h.close();
  });

  it('vt_get_exchange_rates posts only the currency lists given', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({ rates: [] });
    const h = await createTestHarness(registerReferenceTools);
    await h.callTool('vt_get_exchange_rates', { source_currencies: ['EUR'] });
    expect(post).toHaveBeenCalledWith('/exchange-rates', { sourceCurrencies: ['EUR'] }, { cache: 'static' });
    await h.close();
  });
});
