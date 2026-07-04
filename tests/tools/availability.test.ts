import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestHarness } from '@chrischall/mcp-utils/test';
import { registerAvailabilityTools } from '../../src/tools/availability.js';
import { client } from '../../src/client.js';

afterEach(() => vi.restoreAllMocks());

describe('availability tools', () => {
  it('vt_get_availability_schedule fetches the schedule for a product', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ productCode: '5010SYDNEY', bookableItems: [] });
    const h = await createTestHarness(registerAvailabilityTools);
    await h.callTool('vt_get_availability_schedule', { product_code: '5010SYDNEY' });
    expect(get.mock.calls[0][0]).toBe('/availability/schedules/5010SYDNEY');
    await h.close();
  });

  it('rejects a path-escaping product code', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAvailabilityTools);
    const res = await h.callTool('vt_get_availability_schedule', { product_code: 'a/b' });
    expect(res.isError).toBe(true);
    expect(get).not.toHaveBeenCalled();
    await h.close();
  });
});
