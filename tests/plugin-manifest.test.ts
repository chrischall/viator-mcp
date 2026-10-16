import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
) as Record<string, unknown>;

describe('.claude-plugin/plugin.json', () => {
  it('declares its MCP config under `mcpServers`, the key Claude Code reads', () => {
    expect(manifest).toHaveProperty('mcpServers');
    // `mcp` is not a plugin.json field: Claude Code ignores it at load time.
    expect(manifest).not.toHaveProperty('mcp');
  });

  it('points `mcpServers` at a file that exists', () => {
    const ref = manifest.mcpServers;
    expect(typeof ref).toBe('string');
    expect(existsSync(join(ROOT, ref as string))).toBe(true);
  });
});

// A git-source marketplace install never builds the repo, so `dist/`
// (gitignored) is absent and a `node ${CLAUDE_PLUGIN_ROOT}/dist/...` launch
// fails to connect (fleet-audit#1195). Launch the published package instead.
describe('.mcp.json launch', () => {
  const mcp = JSON.parse(readFileSync(join(ROOT, '.mcp.json'), 'utf8')) as {
    mcpServers: Record<string, { command: string; args: string[] }>;
  };
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { name: string };

  it('launches the published package with npx, never a dist/ path', () => {
    for (const server of Object.values(mcp.mcpServers)) {
      expect(server.command).toBe('npx');
      expect(server.args).toEqual(['-y', pkg.name]);
      expect(JSON.stringify(server)).not.toContain('dist/');
    }
  });
});
