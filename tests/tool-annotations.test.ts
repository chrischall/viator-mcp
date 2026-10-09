import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerProductTools } from '../src/tools/products.js';
import { registerAttractionTools } from '../src/tools/attractions.js';
import { registerAvailabilityTools } from '../src/tools/availability.js';
import { registerSearchTools } from '../src/tools/search.js';
import { registerReferenceTools } from '../src/tools/reference.js';
import { registerHealthcheckTools } from '../src/tools/health.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

interface Ann {
  readOnlyHint?: unknown;
  destructiveHint?: unknown;
  openWorldHint?: unknown;
}

/**
 * Reads the REGISTERED config, not a hand-kept list: a recording server
 * captures every registerTool call, so a tool registered through a shared
 * helper (vt_healthcheck) is covered too. (The mcp-utils test harness's
 * listTools() drops annotations, so it cannot be used here.)
 */
async function servedAnnotations(): Promise<Record<string, Ann | undefined>> {
  const seen: Record<string, Ann | undefined> = {};
  const server = {
    registerTool: (name: string, cfg: { annotations?: Ann }) => {
      seen[name] = cfg.annotations;
      return {};
    },
  } as never;
  for (const register of [
    registerProductTools,
    registerAttractionTools,
    registerAvailabilityTools,
    registerSearchTools,
    registerReferenceTools,
    registerHealthcheckTools,
  ]) {
    register(server);
  }
  return seen;
}

describe('tool annotations', () => {
  it('covers the full surface (guards against a registrar being dropped here)', async () => {
    expect(Object.keys(await servedAnnotations())).toHaveLength(11);
  });

  it('sets an explicit boolean readOnlyHint on every tool', async () => {
    const missing = Object.entries(await servedAnnotations())
      .filter(([, a]) => typeof a?.readOnlyHint !== 'boolean')
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });

  // destructiveHint DEFAULTS TO TRUE when readOnlyHint is false, so a write
  // that forgets it publishes as destructive and nothing fails.
  it('sets an explicit boolean destructiveHint on every write', async () => {
    const undeclared = Object.entries(await servedAnnotations())
      .filter(([, a]) => a?.readOnlyHint === false && typeof a?.destructiveHint !== 'boolean')
      .map(([name]) => name);
    expect(undeclared).toEqual([]);
  });

  it('never lets a read claim to be destructive', async () => {
    const contradictory = Object.entries(await servedAnnotations())
      .filter(([, a]) => a?.readOnlyHint === true && a?.destructiveHint === true)
      .map(([name]) => name);
    expect(contradictory).toEqual([]);
  });

  it('marks every tool open-world (each one calls the Viator Partner API)', async () => {
    const closed = Object.entries(await servedAnnotations())
      .filter(([, a]) => a?.openWorldHint !== true)
      .map(([name]) => name);
    expect(closed).toEqual([]);
  });

  it('is entirely read-only (Basic Access affiliate tier has no write endpoints)', async () => {
    const writes = Object.entries(await servedAnnotations())
      .filter(([, a]) => a?.readOnlyHint !== true)
      .map(([name]) => name);
    expect(writes).toEqual([]);
  });
});

describe('install manifests match the served surface', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  const serverJson = JSON.parse(readFileSync(join(ROOT, 'server.json'), 'utf8'));
  const mcpJson = JSON.parse(readFileSync(join(ROOT, '.mcp.json'), 'utf8'));
  const ENV_KEYS = [
    'VIATOR_API_KEY',
    'VIATOR_API_BASE_URL',
    'VIATOR_LANGUAGE',
    'VIATOR_CACHE_TTL',
    'VIATOR_STATIC_CACHE_TTL',
  ].sort();

  it('manifest.json tools[] lists exactly the served tools', async () => {
    const served = Object.keys(await servedAnnotations()).sort();
    const listed = (manifest.tools as { name: string }[]).map((t) => t.name).sort();
    expect(listed).toEqual(served);
  });

  it('manifest.json, server.json and .mcp.json declare every env var the server reads', () => {
    expect(Object.keys(manifest.server.mcp_config.env).sort()).toEqual(ENV_KEYS);
    expect(
      (serverJson.packages[0].environmentVariables as { name: string }[]).map((e) => e.name).sort(),
    ).toEqual(ENV_KEYS);
    expect(Object.keys(mcpJson.mcpServers.viator.env).sort()).toEqual(ENV_KEYS);
  });
});
