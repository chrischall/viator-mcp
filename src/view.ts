import { minifiedResult, resolveView, stripMediaUrls, viewParam, type View } from '@chrischall/mcp-utils';
import { compactProductsEnvelope } from './tools/shared.js';

/**
 * The rungs this server honours (`@chrischall/mcp-utils`' `view` vocabulary;
 * `chrischall/workflows` `docs/fleet-conventions.md`, "Response shape").
 *
 * **What compact does here, and what it deliberately does NOT do.**
 *
 * Two things happen on the compact rung, and they are grounded differently.
 *
 * `vt_search_products` gets a REAL field projection —
 * `compactProductsEnvelope` in `tools/shared.ts`, which has been here all along
 * behind an opt-in `compact: false`. It is documented, it names its fields, and
 * it degrades safely. Defaulting it on is the whole point of this vocabulary.
 *
 * Every other read tool gets media stripping only. The repo holds no captured
 * payload for those endpoints, so nothing here can honestly say which of their
 * fields matter — and a subtractive rule cannot lose a field nobody knew about,
 * which is the failure an invented field list would risk.
 *
 * The first pass of this rollout (#69) shipped the second half and MISSED the
 * first: the search tool kept its own `compact` boolean beside the new `view`,
 * so one server had two vocabularies and the one tool with a real projection
 * still defaulted to the fat rung.
 */
export const VIATOR_VIEWS = ['compact', 'full'] as const;

const NOTE =
  'compact strips image/avatar URLs from the response; "full" returns Viator\'s payload untouched. ' +
  'No field projection: this server has no verified record of which Viator fields matter, and inventing ' +
  'one would risk dropping a field a caller needs.';

/** The `view` parameter every read tool in this server takes. */
export const viewArg = (): ReturnType<typeof viewParam> => viewParam(VIATOR_VIEWS, { note: NOTE });

/**
 * Answer in the requested rung.
 *
 * Only ever called from a READ tool. A write's response is a receipt — an id,
 * a status — with nothing to strip and everything to keep.
 */
export function viewResponse(
  view: string | undefined,
  data: unknown,
  opts: { products?: boolean } = {},
): ReturnType<typeof minifiedResult> {
  const rung: View = resolveView(view, VIATOR_VIEWS);
  if (rung !== 'compact') return minifiedResult(data);
  // A hand-written projection is NOT then media-stripped. It was written with
  // knowledge of the API and deliberately keeps `coverImageUrl` as one of its
  // named summary fields; running a blind subtractive rule over it would
  // overrule a grounded decision with an un-grounded one. Media stripping is
  // for the payloads that have no projection to speak for them.
  if (opts.products === true) return minifiedResult(compactProductsEnvelope(data));
  return minifiedResult(stripMediaUrls(data));
}
