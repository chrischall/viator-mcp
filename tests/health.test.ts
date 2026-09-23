import { describe, it, expect, vi } from 'vitest';
import { createTestHarness, parseToolResult } from '@chrischall/mcp-utils/test';
import { registerHealthcheckTools } from '../src/tools/health.js';

function setup(env: Record<string, string | undefined>, probe?: () => Promise<unknown>) {
  const post = vi.fn(probe ?? (async () => ({ rates: [] })));
  const harness = createTestHarness((s) => registerHealthcheckTools(s, { post } as any, (k: string) => env[k]));
  const call = async () => parseToolResult<any>(await (await harness).callTool('vt_healthcheck'));
  const names = async () => (await (await harness).listTools()).map((t) => t.name);
  return { call, post, names };
}

const FULL = { VIATOR_API_KEY: 'KEY' };

describe('vt_healthcheck', () => {
  it('registers under the repo tool prefix', async () => {
    expect(await setup(FULL).names()).toEqual(['vt_healthcheck']);
  });

  it('reports ok when the key resolves and the probe succeeds', async () => {
    expect((await setup(FULL).call()).ok).toBe(true);
  });

  // The probe must reach api.viator.com every time: a cached probe would
  // report ok during an outage or after the key is revoked mid-session
  // (chrischall/fleet-audit#273). It uses a one-pair exchange-rate lookup —
  // tiny and cheap — rather than the multi-MB /destinations taxonomy.
  it('probes a small live endpoint with the response cache bypassed', async () => {
    const { call, post } = setup(FULL);
    await call();
    expect(post).toHaveBeenCalledWith(
      '/exchange-rates',
      { sourceCurrencies: ['USD'], targetCurrencies: ['EUR'] },
      { cache: 'none' },
    );
  });

  it('re-probes upstream on every call instead of reusing an earlier success', async () => {
    const { call, post } = setup(FULL);
    await call();
    await call();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('bypasses a real client cache warmed by an earlier reference-data call', async () => {
    const { ViatorClient } = await import('../src/client.js');
    let up = true;
    const fetchImpl = vi.fn(async () =>
      up ? new Response(JSON.stringify({ rates: [] }), { status: 200 }) : new Response('down', { status: 500 }),
    );
    const client = new ViatorClient({ apiKey: 'K', fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => {} });
    const h = await createTestHarness((s) => registerHealthcheckTools(s, client, (k: string) => FULL[k as 'VIATOR_API_KEY']));
    expect(parseToolResult<any>(await h.callTool('vt_healthcheck')).ok).toBe(true);
    up = false;
    expect(parseToolResult<any>(await h.callTool('vt_healthcheck')).ok).toBe(false);
  });

  it('reports a missing key as no_credential and skips the probe', async () => {
    const { call, post } = setup({});
    expect((await call()).error.kind).toBe('no_credential');
    expect(post).not.toHaveBeenCalled();
  });

  it('never echoes the key', async () => {
    const out = await setup({ VIATOR_API_KEY: 'SUPER-SECRET' }).call();
    expect(JSON.stringify(out)).not.toContain('SUPER-SECRET');
  });

  // A sandbox key against production is refused exactly like an invalid one.
  it('mentions the sandbox/production split when the key is rejected', async () => {
    const out = await setup(FULL, async () => { throw new Error('HTTP 403 Forbidden'); }).call();
    expect(out.error.kind).toBe('credential_rejected');
    expect(out.hint).toMatch(/sandbox/i);
  });

  it('leaves an unrecognised failure to the helper defaults', async () => {
    const out = await setup(FULL, async () => { throw new Error('socket hang up'); }).call();
    expect(out.ok).toBe(false);
    expect(out.error.kind).not.toBe('credential_rejected');
  });

  it('classifies a non-Error throw without crashing', async () => {
    const out = await setup(FULL, async () => { throw 'HTTP 401 Unauthorized'; }).call();
    expect(out.error.kind).toBe('credential_rejected');
  });

  it('reads the real environment when no reader is injected', async () => {
    vi.stubEnv('VIATOR_API_KEY', 'REAL-KEY');
    const h = await createTestHarness((s) =>
      registerHealthcheckTools(s, { post: vi.fn(async () => ({})) } as any),
    );
    const out = parseToolResult<any>(await h.callTool('vt_healthcheck'));
    expect(out.credential.resolved).toBe(true);
    expect(JSON.stringify(out)).not.toContain('REAL-KEY');
    vi.unstubAllEnvs();
  });
});
