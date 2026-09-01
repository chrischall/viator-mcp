import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readEnvVar } from '@chrischall/mcp-utils';
import { registerCredentialHealthcheckTool } from '@chrischall/mcp-utils/healthcheck';
import { client as defaultClient } from '../client.js';

/**
 * `vt_healthcheck` — the one call that answers "is this connector working?",
 * and the only tool here that reports a failure as DATA rather than throwing.
 *
 * Viator had none. Every other tool is a catalogue query, so a failure there
 * is ambiguous in a way that matters commercially: "no products for that
 * destination" and "this key is not authorised" look identical from a caller's
 * seat, and only one of them is a configuration problem.
 *
 * The probe is `/destinations` with `cache: 'static'` — Viator's reference
 * list, which every partner tier can read and which changes rarely, so repeat
 * checks are served from cache rather than spending API quota.
 */

type ReadEnv = (key: string) => string | undefined;

export function classifyViatorError(err: unknown): { kind: string; hint?: string } | undefined {
  const msg = err instanceof Error ? err.message : String(err);

  if (/401|403|unauthorized|forbidden/i.test(msg)) {
    return {
      kind: 'credential_rejected',
      hint:
        'Viator rejected the key. Check VIATOR_API_KEY, and that it is the right environment: Viator issues ' +
        'separate sandbox and production keys, and a sandbox key against the production API is refused exactly ' +
        'like an invalid one.',
    };
  }
  return undefined;
}

export function registerHealthcheckTools(
  server: McpServer,
  client: Pick<typeof defaultClient, 'get'> = defaultClient,
  /** Seam: injectable so tests need no process env. */
  readEnv: ReadEnv = (k) => readEnvVar(k),
): void {
  registerCredentialHealthcheckTool({
    server,
    prefix: 'vt',
    hostLabel: 'api.viator.com',
    probePath: '/destinations',
    resolveCredential: async () => ({ source: readEnv('VIATOR_API_KEY') ? 'VIATOR_API_KEY' : null }),
    probeFn: () => client.get('/destinations', { cache: 'static' }),
    classifyThrown: classifyViatorError,
  });
}
