import { minifiedResult, resolveView, stripMediaUrls, viewParam, type View } from '@chrischall/mcp-utils';

/**
 * The rungs this server honours (`@chrischall/mcp-utils`' `view` vocabulary;
 * `chrischall/workflows` `docs/fleet-conventions.md`, "Response shape").
 *
 * **Which tier this repo is in — stated plainly, because the first two passes
 * got it wrong.** #69 rolled `view` out here as an "un-grounded" server: no
 * captured payload, no documented field list, therefore media stripping and
 * nothing more. Both halves of that were false, and the docblock kept most of
 * the claim after #72 corrected half of it. What is actually true:
 *
 * - `docs/VIATOR-API.md` pins the response shape of every endpoint this server
 *   calls, field by field, live-verified 2026-07-05 against a Basic Access key.
 *   There IS a documented field list here, and `compactProduct` was written off
 *   exactly it.
 * - `compactProduct` / `compactProductsEnvelope` (`tools/shared.ts`) predate
 *   the rollout — a real, named, drift-safe field projection over Viator's
 *   ProductSummary. #69's fleet survey missed it because it looked for a
 *   `prune`/`compact()`-shaped helper and this one is named for its payload.
 *
 * So: the two tools that return ProductSummary records — `vt_search_products`
 * and `vt_search_freetext` — run that projection on their compact rung. The
 * other eight get media stripping. Not because their fields are unknown (they
 * are pinned in the doc above), but because no projection has been written and
 * measured for them yet. That is a backlog item, not an epistemic ceiling, and
 * when one is written it belongs here beside these two.
 *
 * One rule the projected tools depend on: **a hand-written projection is NOT
 * then media-stripped.** `compactProduct` deliberately keeps `coverImageUrl` as
 * one of its named summary fields; running a blind subtractive rule over its
 * output would overrule a decision made WITH knowledge of the API using one
 * made without.
 */
export const VIATOR_VIEWS = ['compact', 'full'] as const;

/**
 * The note for a tool whose compact rung is media stripping and nothing else.
 *
 * A tool with a real projection passes its OWN note naming the fields it keeps.
 * One shared note cannot describe both: the version this file used to ship
 * promised "no field projection" on all ten tools while two of them ran one,
 * and a note that describes a rung the tool does not have is worse than a
 * generic one — the caller acts on it.
 */
const MEDIA_NOTE =
  'compact strips image/avatar URLs from the response; "full" returns Viator\'s payload untouched. ' +
  'No field projection on this tool — every other field comes back as Viator sent it.';

/**
 * The `view` parameter a read tool takes. Pass `note` on a tool whose compact
 * rung is a field projection, so the schema says what that tool actually keeps.
 */
export const viewArg = (note: string = MEDIA_NOTE): ReturnType<typeof viewParam> =>
  viewParam(VIATOR_VIEWS, { note });

/**
 * Answer in the requested rung.
 *
 * `project` is the tool's own field projection, run INSTEAD of media stripping
 * (see the rule in the docblock above); omit it and compact media-strips.
 *
 * Only ever called from a READ tool. A write's response is a receipt — an id,
 * a status — with nothing to strip and everything to keep.
 */
export function viewResponse(
  view: string | undefined,
  data: unknown,
  project?: (data: unknown) => unknown,
): ReturnType<typeof minifiedResult> {
  const rung: View = resolveView(view, VIATOR_VIEWS);
  if (rung !== 'compact') return minifiedResult(data);
  return minifiedResult(project ? project(data) : stripMediaUrls(data));
}
