# Viator Partner API v2 — Basic Access surface (pinned)

Extracted from https://docs.viator.com/partner-api/technical/ (July 2026). This file pins the
request/response shapes this server is coded against. **Live-verified 2026-07-05** against the
sandbox API (`api.sandbox.viator.com`) with a Basic Access key — see the checklist at the bottom.

## Global

- **Base URL (production)**: `https://api.viator.com/partner`
- **Base URL (sandbox, test data)**: `https://api.sandbox.viator.com/partner`
- **Auth**: `exp-api-key: <uuid>` header on every call.
- **Versioning**: `Accept: application/json;version=2.0` required on every call — omitting it is a 400.
- **Localization**: `Accept-Language` required on endpoints returning natural language
  (all except `/products/tags`, `/exchange-rates`, `/availability/schedules/*`).
  Values: `en`, `en-US`, `es`, `fr`, `de`, `it`, `pt`, `ja`, `da`, `nl`, `no`, `sv`, + regionals.
- **Affiliate params**: `campaign-value` (query, ≤200 chars) appends campaign tracking to returned
  `productUrl`/`attractionUrl`/`destinationUrl`. URLs must be used verbatim or attribution fails.
- **Rate limiting**: per-endpoint / per-PUID rolling 10s window (example: 16 req/10s; actual limit
  is per-account). 429 carries `RateLimit-Limit/-Remaining/-Reset` + `Retry-After` (seconds).
  Systemwide concurrency pressure returns 503 + `Retry-After`. Both are also possible on any call.
- **Errors**: `{ code, message, timestamp, trackingId }`; statuses 400/401/403/404/405/406/429/500/503.
- **Tracking**: every response carries `X-Unique-ID` — quote it in Viator support requests.

## Basic Access endpoints (the tier this server targets)

| Endpoint | Method | Notes |
|---|---|---|
| `/products/search` | POST | primary search; active products only |
| `/products/{product-code}` | GET | full product details |
| `/products/tags` | GET | all tags, all locales; cache weekly |
| `/attractions/search` | POST | by destinationId; cache weekly |
| `/attractions/{attraction-id}` | GET | single attraction |
| `/availability/schedules/{product-code}` | GET | supplier-currency pricing |
| `/search/freetext` | POST | products/attractions/destinations |
| `/locations/bulk` | POST | ≤500 refs per call |
| `/exchange-rates` | POST | cache until `expiry` |
| `/destinations` | GET | full taxonomy; cache weekly |

Not in Basic Access (do not build): `/products/modified-since`, `/products/bulk`,
`/products/booking-questions`, `/products/recommendations`, `/availability/check`,
`/availability/schedules/bulk|modified-since`, `/reviews/product`, all `/bookings/*` (except
`GET /bookings/modified-since`, which is useless without booking), `/suppliers/*`.

## POST /products/search

Body: `{ filtering, sorting?, pagination?, currency }`

- `filtering` (required): `destination` (string id), `tags` (int[]), `flags` (string[]:
  `LIKELY_TO_SELL_OUT`, `FREE_CANCELLATION`, `PRIVATE_TOUR`, `NEW_ON_VIATOR`, `SKIP_THE_LINE` per docs),
  `lowestPrice`/`highestPrice` (numbers in `currency`), `startDate`/`endDate` (`YYYY-MM-DD`),
  `includeAutomaticTranslations` (bool), `confirmationType`, `durationInMinutes` `{from,to}`,
  `rating` `{from,to}` (0–5). Flags `FREE_CANCELLATION` + `LIKELY_TO_SELL_OUT` verified live.
- `sorting`: `{ sort, order }`; sort ∈ `DEFAULT|PRICE|TRAVELER_RATING|ITINERARY_DURATION|DATE_ADDED`
  (all five verified live; unknown values → 400 "Unknown search sorting field"), order ∈ `ASCENDING|DESCENDING`.
- `pagination`: `{ start, count }` — 1-based start; count above 50 is silently CLAMPED to 50
  (no 400) — verified live.
- `currency` (required): one of `AED ARS AUD BRL CAD CHF CLP CNY COP DKK EUR FJD GBP HKD IDR ILS
  INR ISK JPY KRW MXN MYR NOK NZD PEN PHP PLN RUB SEK SGD THB TRY TWD USD VND ZAR`.

Response: `{ products: ProductSummary[], totalCount }`. ProductSummary: `productCode`, `title`,
`description`, `images[]{imageSource,caption,isCover,variants[]{height,width,url}}`,
`reviews{sources[],totalReviews,combinedAverageRating}`, `duration{fixedDurationInMinutes|...}`,
`confirmationType`, `itineraryType`, `pricing{summary{fromPrice,fromPriceBeforeDiscount},currency}`,
`productUrl`, `destinations[]{ref,primary}`, `tags[]`, `flags[]`.

## GET /products/{product-code}

Query: `campaign-value?`, `target-lander?` (`NONE`). Response is one product object, polymorphic on
`status` (`ACTIVE`|`INACTIVE` — inactive is near-empty). Key fields: `productCode`, `title`,
`description`, `ticketInfo`, `pricingInfo`, `images[]`, `logistics`, `timeZone`, `inclusions[]`,
`exclusions[]`, `additionalInfo[]`, `cancellationPolicy`, `bookingConfirmationSettings{confirmationType:
INSTANT|MANUAL|INSTANT_THEN_MANUAL}`, `bookingRequirements`, `languageGuides[]`, `bookingQuestions[]`,
`tags[]` (ints → `/products/tags`), `destinations[]{ref,primary}` (→ `/destinations`), `itinerary`,
`productOptions[]`, `supplier`, `productUrl` (affiliate), `reviews{totalReviews,combinedAverageRating}`.

## GET /products/tags

No params; no Accept-Language (all locales at once). Response:
`{ tags: [{ tagId, parentTagIds?, allNamesByLocale: { en, de, fr, ... } }] }`. Cache weekly.

## POST /attractions/search

Body: `{ destinationId (required, int), sorting? { sort: DEFAULT|ALPHABETICAL|REVIEW_AVG_RATING (all three
verified live) }, pagination? { start, count } }` — count above 30 → 400 "pagination.count must be
between 1 and 30" (verified live; NOT clamped, unlike /products/search).
Response: `{ attractions: AttractionDetails[], totalCount }`.

## GET /attractions/{attraction-id}

Query: `campaign-value?`. Response: `{ attractionId, name, destinations[]{id,primary},
attractionUrl (verbatim!), productCount, productCodes[], images[], reviews, freeAttraction,
openingHours, center{latitude,longitude}, address }`.

## GET /availability/schedules/{product-code}

No Accept-Language. Pricing in the **supplier's currency** — convert via `/exchange-rates`.
Response: `{ productCode, bookableItems[]: { productOptionCode, seasons[]: { startDate, endDate?,
pricingRecords[]: { daysOfWeek[], timedEntries[]{startTime, unavailableDates[]{date,reason}},
pricingDetails[]{pricingPackageType, minTravelers, ageBand, price{original{recommendedRetailPrice,
partnerNetPrice, bookingFee, partnerTotalPrice}, special?}} } } }, currency, summary{fromPrice},
extraChargesSummary? }`.

## POST /search/freetext

Body: `{ searchTerm (required), searchTypes (required, 1..3 of { searchType:
PRODUCTS|ATTRACTIONS|DESTINATIONS, pagination{start,count} }), currency (required),
productFiltering? { destination, dateRange{from,to}, price{from,to}, rating{from,to},
durationInMinutes{from,to}, tags[], flags[], includeAutomaticTranslations },
productSorting? { sort, order } }`. Products `count: 50` accepted (verified live).
Response: per-type blocks `{ products?/attractions?/destinations?: { totalCount, results[] } }`;
product results are ProductSummary; destination results `{ id, name, parentDestinationId, ... }`;
attraction results `{ id, name, primaryDestinationId, productsCount, reviews, images, ... }`.

## POST /locations/bulk

Body: `{ locations: string[] }` — ≤500 refs (`LOC-...`, `CONTACT_SUPPLIER_LATER`, ...).
Response: `{ locations: [{ provider: GOOGLE|TRIPADVISOR, reference, providerReference?
(Google place id), name?, address?{street,administrativeArea,state,country,countryCode,postcode},
center?{latitude,longitude} }] }`. Cache monthly.

## POST /exchange-rates

Body: `{ sourceCurrencies?: string[], targetCurrencies?: string[] }` (cross-product of pairs).
Response: `{ rates: [{ sourceCurrency, targetCurrency, rate, lastUpdated, expiry }] }`.
Cache until `expiry` (currently ~daily). No Accept-Language.

## GET /destinations

Query: `campaign-value?`. Response: `{ destinations: [{ destinationId, name, type
(CITY/REGION/COUNTRY/...), parentDestinationId, lookupId, destinationUrl, defaultCurrencyCode,
timeZone, iataCodes[], countryCallingCode, languages[], center{latitude,longitude} }], totalCount }`.
Cache weekly.

## Live-verification checklist (completed 2026-07-05, sandbox + Basic Access key)

- [x] Sort enums: products all 5 values OK (bogus → 400 "Unknown search sorting field");
      attractions all 3 values OK
- [x] Pagination caps: /products/search count>50 silently clamps to 50; /attractions/search
      count>30 → 400 "pagination.count must be between 1 and 30"; freetext products count=50 OK
- [x] `flags` filter: FREE_CANCELLATION + LIKELY_TO_SELL_OUT combined filter works
- [x] Sandbox keys do NOT work against production (401 "Invalid API Key") — use
      VIATOR_API_BASE_URL=https://api.sandbox.viator.com/partner. New accounts get ONLY a
      sandbox key; production keys are generated separately (portal → Affiliate API → Get key).
      A fresh key can take up to 24h to activate; a restricted (unverified) account 401s on
      every host until identity verification completes.
- [x] All 10 endpoints probed through the built client (`node scripts/live-probe.mjs`);
      response shapes matched this doc, incl. the compact projection on real data
