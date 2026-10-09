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
