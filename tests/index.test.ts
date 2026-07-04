import { describe, it, expect } from 'vitest';
import { createTestHarness } from '@chrischall/mcp-utils/test';
import { registerProductTools } from '../src/tools/products.js';
import { registerAttractionTools } from '../src/tools/attractions.js';
import { registerAvailabilityTools } from '../src/tools/availability.js';
import { registerSearchTools } from '../src/tools/search.js';
import { registerReferenceTools } from '../src/tools/reference.js';

describe('tool roster', () => {
  it('registers exactly the expected tools', async () => {
    const h = await createTestHarness((s) => {
      registerProductTools(s);
      registerAttractionTools(s);
      registerAvailabilityTools(s);
      registerSearchTools(s);
      registerReferenceTools(s);
    });
    const names = (await h.listTools()).map((t) => t.name).sort();
    expect(names).toEqual([
      'vt_get_attraction',
      'vt_get_availability_schedule',
      'vt_get_exchange_rates',
      'vt_get_locations',
      'vt_get_product',
      'vt_list_destinations',
      'vt_list_product_tags',
      'vt_search_attractions',
      'vt_search_freetext',
      'vt_search_products',
    ]);
    await h.close();
  });
});
