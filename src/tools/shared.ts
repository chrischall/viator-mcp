import { z } from 'zod';
import { buildQueryString, stripMediaUrls } from '@chrischall/mcp-utils';

/**
 * Product code (e.g. `5010SYDNEY`, `250380P1`). Interpolated into the URL
 * path, so the charset is restricted to what real codes use — letters, digits,
 * `_` and `-` — which by construction can't escape the path segment.
 */
export const ProductCode = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/, 'must be a Viator product code (letters, digits, "_", "-")');

/** Attraction id — a positive integer (path segment). */
export const AttractionId = z.number().int().positive();

/** Currencies accepted by the search/pricing endpoints (docs/VIATOR-API.md). */
export const CURRENCIES = [
  'AED', 'ARS', 'AUD', 'BRL', 'CAD', 'CHF', 'CLP', 'CNY', 'COP', 'DKK', 'EUR', 'FJD',
  'GBP', 'HKD', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD',
  'PEN', 'PHP', 'PLN', 'RUB', 'SEK', 'SGD', 'THB', 'TRY', 'TWD', 'USD', 'VND', 'ZAR',
] as const;

/** Sort keys documented for product search (docs list; live-verify pending). */
export const PRODUCT_SORTS = ['DEFAULT', 'PRICE', 'TRAVELER_RATING', 'ITINERARY_DURATION', 'DATE_ADDED'] as const;
export const SORT_ORDERS = ['ASCENDING', 'DESCENDING'] as const;

/** Shared pagination knobs — Viator pagination is 1-based { start, count }. */
export const paginationParams = {
  start: z.number().int().min(1).default(1).describe('1-based index of the first result to return'),
  count: z.number().int().min(1).max(50).default(10).describe('Results per page (max 50; default 10)'),
};

/** Affiliate campaign tracking; appended by Viator to the returned booking URLs. */
export const campaignParam = {
  campaign_value: z
    .string()
    .max(200)
    .optional()
    .describe('Affiliate campaign tracking id — appended to the productUrl/attractionUrl/destinationUrl Viator returns'),
};

export const currencyParam = {
  currency: z.enum(CURRENCIES).default('USD').describe('Currency for request/response prices (default USD)'),
};

/** Build a `?a=b` query string, dropping undefined values. */
export function qs(params: Record<string, unknown>): string {
  return buildQueryString(params);
}

/** Drop undefined entries so request bodies only carry the filters the caller set. */
export function prune<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

/** A `{from, to}` range with only the ends the caller set; undefined when neither. */
export function range(from?: number, to?: number): { from?: number; to?: number } | undefined {
  if (from === undefined && to === undefined) return undefined;
  return prune({ from, to });
}

/** Slim summary of a ProductSummary for the opt-in `compact` projection —
 * documented fields only, so it degrades to raw output on drift. */
export interface CompactProduct {
  productCode: string;
  title?: string;
  fromPrice?: number;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  durationMinutes?: number;
  confirmationType?: string;
  flags?: string[];
  productUrl?: string;
  coverImageUrl?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function coverImageUrl(p: any): string | undefined {
  const images: any[] = Array.isArray(p.images) ? p.images : [];
  const cover = images.find((i) => i?.isCover) ?? images[0];
  const variants: any[] = Array.isArray(cover?.variants) ? cover.variants : [];
  if (!variants.length) return undefined;
  // Prefer a mid-size variant (~480px wide) over the largest to keep URLs useful.
  const sorted = [...variants].sort((a, b) => (a?.width ?? 0) - (b?.width ?? 0));
  return (sorted.find((v) => (v?.width ?? 0) >= 480) ?? sorted[sorted.length - 1])?.url;
}

export function compactProduct(p: any): CompactProduct {
  return prune({
    productCode: p.productCode,
    title: p.title,
    fromPrice: p.pricing?.summary?.fromPrice,
    currency: p.pricing?.currency,
    rating: p.reviews?.combinedAverageRating,
    reviewCount: p.reviews?.totalReviews,
    durationMinutes:
      p.duration?.fixedDurationInMinutes ??
      p.duration?.variableDurationToMinutes ??
      p.duration?.variableDurationFromMinutes,
    confirmationType: p.confirmationType,
    flags: Array.isArray(p.flags) && p.flags.length ? p.flags : undefined,
    productUrl: p.productUrl,
    coverImageUrl: coverImageUrl(p),
  }) as CompactProduct;
}

/**
 * Apply the compact projection to a `{ products, totalCount }` envelope. When
 * the response doesn't have the expected array (undocumented APIs drift), warn
 * to stderr and return the RAW response rather than an empty/wrong projection.
 */
export function compactProductsEnvelope(data: unknown): unknown {
  const d = data as { products?: unknown; totalCount?: number };
  if (!Array.isArray(d?.products)) {
    console.error('[viator-mcp] /products/search response did not contain a products array; returning raw response');
    return data;
  }
  return { totalCount: d.totalCount, products: d.products.map(compactProduct) };
}

/**
 * What `compactProduct` keeps, in prose — quoted in the `view` note of every
 * tool that runs it, so the schema promises exactly these fields and no others.
 */
export const COMPACT_PRODUCT_FIELDS =
  'product code, title, from-price and currency, rating, review count, duration, ' +
  'confirmation type, flags, booking URL and cover image';

/**
 * Apply the compact projection to a `/search/freetext` envelope.
 *
 * The PRODUCTS block is projected with `compactProduct` — the same grounded
 * projection `vt_search_products` runs, over the same ProductSummary records.
 * The attraction and destination blocks have no projection to speak for them,
 * so they get the media stripping every un-projected payload in this server
 * gets. Each half is handled by the rule it is grounded for.
 *
 * Key order is preserved: the projection replaces the products block in place
 * rather than relocating it to the end of the object.
 *
 * On drift (no `products.results` array) the whole payload falls back to media
 * stripping rather than to an empty or wrong projection — the same failure
 * posture as `compactProductsEnvelope`.
 */
export function compactFreetextEnvelope(data: unknown): unknown {
  const d = data as { products?: { totalCount?: number; results?: unknown[] } };
  const results = d?.products?.results;
  if (!Array.isArray(results)) {
    console.error(
      '[viator-mcp] /search/freetext response did not contain a products.results array; media-stripping the raw response instead of projecting it',
    );
    return stripMediaUrls(data);
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    out[key] =
      key === 'products'
        ? { totalCount: d.products?.totalCount, results: results.map(compactProduct) }
        : stripMediaUrls(value);
  }
  return out;
}
