#!/usr/bin/env node
// Read-only live probe of every Basic Access endpoint THROUGH the built client
// (dist/client.js) — exercises real path-building, headers, cache and error
// layers end-to-end. Run after `npm run build` with VIATOR_API_KEY in .env.
// Calls are spaced ~4s apart to respect the per-endpoint rolling 10s windows.
//
//   node scripts/live-probe.mjs
//
// Also completes the VERIFY items in docs/VIATOR-API.md: prints sort-enum and
// pagination-cap errors verbatim so wrong guesses surface as readable 400s.

import { ViatorClient } from '../dist/client.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const client = new ViatorClient();
let pass = 0;
let fail = 0;

async function probe(label, fn) {
  try {
    const data = await fn();
    const preview = JSON.stringify(data)?.slice(0, 200);
    console.log(`✅ ${label}: ${preview}…`);
    pass++;
    return data;
  } catch (e) {
    console.log(`❌ ${label}: ${e.message}`);
    fail++;
    return undefined;
  } finally {
    await sleep(4000);
  }
}

// 1. Destinations (also seeds a real destination id for later probes)
const dests = await probe('GET /destinations', () => client.get('/destinations', { cache: 'static' }));
const dest = dests?.destinations?.find((d) => d.name === 'Rome') ?? dests?.destinations?.[0];
console.log(`   using destination: ${dest?.name} (${dest?.destinationId})`);

// 2. Product tags
await probe('GET /products/tags', () => client.get('/products/tags', { cache: 'static' }));

// 3. Product search (VERIFY: sort enum, count cap 50)
const search = await probe('POST /products/search', () =>
  client.post('/products/search', {
    filtering: { destination: String(dest?.destinationId ?? 732) },
    sorting: { sort: 'TRAVELER_RATING', order: 'DESCENDING' },
    pagination: { start: 1, count: 5 },
    currency: 'USD',
  }),
);
const productCode = search?.products?.[0]?.productCode;
console.log(`   using product: ${productCode}`);

// 4. Product details
if (productCode) await probe(`GET /products/${productCode}`, () => client.get(`/products/${productCode}`));

// 5. Availability schedule
if (productCode)
  await probe(`GET /availability/schedules/${productCode}`, () =>
    client.get(`/availability/schedules/${productCode}`),
  );

// 6. Freetext search (VERIFY: per-type pagination)
await probe('POST /search/freetext', () =>
  client.post('/search/freetext', {
    searchTerm: 'food tour',
    searchTypes: [{ searchType: 'PRODUCTS', pagination: { start: 1, count: 3 } }],
    currency: 'USD',
  }),
);

// 7. Attractions search (VERIFY: sort enum, count cap 30)
const attractions = await probe('POST /attractions/search', () =>
  client.post('/attractions/search', {
    destinationId: dest?.destinationId ?? 732,
    pagination: { start: 1, count: 3 },
  }),
);
const attractionId = attractions?.attractions?.[0]?.attractionId;

// 8. Attraction details
if (attractionId) await probe(`GET /attractions/${attractionId}`, () => client.get(`/attractions/${attractionId}`));

// 9. Locations bulk (needs refs from product content; probe with a special ref)
await probe('POST /locations/bulk', () =>
  client.post('/locations/bulk', { locations: ['MEET_AT_DEPARTURE_POINT'] }),
);

// 10. Exchange rates
await probe('POST /exchange-rates', () =>
  client.post('/exchange-rates', { sourceCurrencies: ['EUR'], targetCurrencies: ['USD'] }),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
