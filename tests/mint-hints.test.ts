import { describe, it, expect } from 'vitest';
import { createTestHarness } from '@chrischall/mcp-utils/test';
import type { McpServer } from '@modelcontextprotocol/server';
import { registerProductTools } from '../src/tools/products.js';
import { registerAttractionTools } from '../src/tools/attractions.js';
import { registerAvailabilityTools } from '../src/tools/availability.js';
import { registerSearchTools } from '../src/tools/search.js';
import { registerReferenceTools } from '../src/tools/reference.js';
import { registerHealthcheckTools } from '../src/tools/health.js';

/**
 * Context-group hints (`_meta.mint`, the mcp-host context-groups contract),
 * read off the served `tools/list` — what a host sees.
 *
 * Viator is a public catalogue on an affiliate key: it holds no bookings, no
 * itinerary and nothing of the person's own, so it answers no what's-new,
 * what's-due or what's-on ask. Every tool is a `lookup` and nothing is
 * canonical — that is the outcome the plan names as valid, not a gap.
 */
type Listed = {
  name: string;
  inputSchema: { properties?: Record<string, Record<string, unknown>> };
  _meta?: { mint?: Record<string, unknown> };
};

const REGISTRARS = [
  registerProductTools,
  registerAttractionTools,
  registerAvailabilityTools,
  registerSearchTools,
  registerReferenceTools,
  registerHealthcheckTools,
];

const DOMAINS = ['school', 'home', 'work', 'family', 'health', 'money', 'travel', 'food'];
const INTENTS = ['whats-new', 'whats-due', 'whats-on', 'lookup', 'turn-on-off', 'send', 'change', 'other'];
const KEYS = ['domain', 'intent', 'canonical', 'subject', 'when', 'aliases'];
const CANONICAL_INTENTS = ['whats-new', 'whats-due', 'whats-on'];

/** The intent every hinted tool declares — this table is the assertion. */
const EXPECTED_INTENT: Record<string, string> = {
  vt_search_products: 'lookup',
  vt_get_product: 'lookup',
  vt_list_product_tags: 'lookup',
  vt_search_freetext: 'lookup',
  vt_search_attractions: 'lookup',
  vt_get_attraction: 'lookup',
  vt_get_availability_schedule: 'lookup',
  vt_list_destinations: 'lookup',
  vt_get_locations: 'lookup',
  vt_get_exchange_rates: 'lookup',
};

async function served(): Promise<Listed[]> {
  const h = await createTestHarness((s: McpServer) => {
    for (const register of REGISTRARS) register(s);
  });
  const { tools } = await h.client.listTools();
  await h.close();
  return tools as Listed[];
}

/** readOnlyHint off the registered config (the harness's listTools may drop annotations). */
function readOnly(): Record<string, boolean | undefined> {
  const seen: Record<string, boolean | undefined> = {};
  const server = {
    registerTool: (name: string, cfg: { annotations?: { readOnlyHint?: boolean } }) => {
      seen[name] = cfg.annotations?.readOnlyHint;
      return {};
    },
  } as never;
  for (const register of REGISTRARS) register(server);
  return seen;
}

describe('_meta.mint on tools/list', () => {
  it('every tool except the healthcheck is hinted, and the table names them all', async () => {
    const tools = await served();
    const hinted = tools.filter((t) => !t.name.endsWith('_healthcheck'));
    expect(hinted.map((t) => t.name).sort()).toEqual(Object.keys(EXPECTED_INTENT).sort());
    expect(tools.find((t) => t.name === 'vt_healthcheck')?._meta?.mint).toBeUndefined();
  });

  it.each(Object.entries(EXPECTED_INTENT))('%s declares domain travel and intent %s', async (name, intent) => {
    const mint = (await served()).find((t) => t.name === name)?._meta?.mint;
    expect(mint, name).toBeDefined();
    expect(mint!.domain).toBe('travel');
    expect(mint!.intent).toBe(intent);
  });

  it('every hint is shaped per the host contract', async () => {
    const ro = readOnly();
    for (const t of await served()) {
      if (t.name.endsWith('_healthcheck')) continue;
      const m = t._meta!.mint!;
      const props = t.inputSchema.properties ?? {};
      expect(Object.keys(m).filter((k) => !KEYS.includes(k)), t.name).toEqual([]);
      expect(DOMAINS, t.name).toContain(m.domain);
      expect(INTENTS, t.name).toContain(m.intent);
      if ('canonical' in m) {
        expect(m.canonical, t.name).toBe(true);
        expect(ro[t.name], t.name).toBe(true);
        expect(CANONICAL_INTENTS, t.name).toContain(m.intent);
      }
      if ('subject' in m) expect(props, t.name).toHaveProperty(m.subject as string);
      if ('when' in m) {
        const when = m.when as Record<string, string>;
        expect(Object.keys(when).sort(), t.name).toEqual(['end', 'start']);
        expect(props, t.name).toHaveProperty(when.start);
        expect(props, t.name).toHaveProperty(when.end);
      }
      if ('aliases' in m) {
        const aliases = m.aliases as string[];
        expect(aliases.length, t.name).toBeGreaterThan(0);
        expect(aliases.length, t.name).toBeLessThanOrEqual(8);
        for (const a of aliases) {
          expect(a.length, t.name).toBeLessThanOrEqual(40);
          expect(a, t.name).toBe(a.toLowerCase());
          expect(a.startsWith('vt_'), t.name).toBe(false);
        }
      }
    }
  });

  it('nothing is canonical: a public catalogue answers no what’s-new / what’s-due / what’s-on ask', async () => {
    const canonical = (await served()).filter((t) => t._meta?.mint?.canonical === true).map((t) => t.name);
    expect(canonical).toEqual([]);
    for (const intent of CANONICAL_INTENTS) {
      expect((await served()).filter((t) => t._meta?.mint?.intent === intent).map((t) => t.name), intent).toEqual([]);
    }
  });

  it('no subject: the catalogue’s destinations are not the person’s subjects', async () => {
    for (const t of await served()) expect(t._meta?.mint ?? {}, t.name).not.toHaveProperty('subject');
  });

  it('the two product searches name their date range for the host to fill', async () => {
    const tools = await served();
    for (const name of ['vt_search_products', 'vt_search_freetext']) {
      expect(tools.find((t) => t.name === name)?._meta?.mint?.when, name).toEqual({ start: 'start_date', end: 'end_date' });
    }
  });

  it('the searches carry the words a person says for a tour', async () => {
    const tools = await served();
    for (const name of ['vt_search_products', 'vt_search_freetext']) {
      const aliases = tools.find((t) => t.name === name)?._meta?.mint?.aliases as string[];
      expect(aliases, name).toEqual(expect.arrayContaining(['tours', 'things to do', 'excursions']));
    }
  });
});
