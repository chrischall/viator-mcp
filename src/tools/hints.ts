/**
 * Context-group hints, published on each tool as `_meta.mint` (mcp-host's
 * `mintHintSchema`, the context-groups contract). Inert data: a host that does
 * not read them sees an extra `_meta` key and nothing else. The shape is fixed
 * by the host's contract and restated here rather than imported — this server
 * takes no dependency on mcp-host.
 *
 * Every tool here is a `lookup` in the `travel` group, and none is canonical.
 * Viator's Partner API on an affiliate key is a public catalogue: it holds no
 * bookings, no itinerary and nothing of the person's own, so it genuinely
 * answers no what's-new, what's-due or what's-on ask — and with no listable
 * subjects of the person's, no tool names a `subject`. `when` names a tool's
 * own date-range argument names (the host fills them), never values.
 * `aliases` are words a person says: lowercase, at most 8, each ≤ 40 chars.
 */
export interface MintHint {
  domain: 'travel';
  intent: 'lookup';
  when?: { start: string; end: string };
  aliases?: string[];
}

/** What people call what Viator sells. */
export const TOUR_ALIASES = [
  'tours',
  'things to do',
  'activities',
  'excursions',
  'day trips',
  'experiences',
  'tickets',
  'sightseeing',
];

/** `_meta` for a Viator tool: a travel lookup, with optional range and words. */
export function travelMeta(extra: Omit<MintHint, 'domain' | 'intent'> = {}): { mint: MintHint } {
  return { mint: { domain: 'travel', intent: 'lookup', ...extra } };
}

/** The product searches take an operating-date range as `start_date`/`end_date`. */
export const SEARCH_META = travelMeta({ when: { start: 'start_date', end: 'end_date' }, aliases: TOUR_ALIASES });
