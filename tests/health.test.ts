import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerHealthcheckTools } from '../src/tools/health.js';

function setup(env: Record<string, string | undefined>, probe?: () => Promise<unknown>) {
  const get = vi.fn(probe ?? (async () => ({ destinations: [] })));
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerHealthcheckTools(server, { get } as any, (k: string) => env[k]);
  const call = async () =>
    JSON.parse((await (server as any)._registeredTools.vt_healthcheck.handler({}, {})).content[0].text);
  return { server, call, get };
}

const FULL = { VIATOR_API_KEY: 'KEY' };

describe('vt_healthcheck', () => {
  it('registers under the repo tool prefix', () => {
    expect(Object.keys((setup(FULL).server as any)._registeredTools)).toEqual(['vt_healthcheck']);
  });

  it('reports ok when the key resolves and the probe succeeds', async () => {
    expect((await setup(FULL).call()).ok).toBe(true);
  });

  it('probes cached reference data rather than a live catalogue search', async () => {
    const { call, get } = setup(FULL);
    await call();
    expect(get).toHaveBeenCalledWith('/destinations', { cache: 'static' });
  });

  it('reports a missing key as no_credential and skips the probe', async () => {
    const { call, get } = setup({});
    expect((await call()).error.kind).toBe('no_credential');
    expect(get).not.toHaveBeenCalled();
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
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerHealthcheckTools(server, { get: vi.fn(async () => ({})) } as any);
    const out = JSON.parse(
      (await (server as any)._registeredTools.vt_healthcheck.handler({}, {})).content[0].text,
    );
    expect(out.credential.resolved).toBe(true);
    expect(JSON.stringify(out)).not.toContain('REAL-KEY');
    vi.unstubAllEnvs();
  });
});
