import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDotenvSafely, readEnvVar, formatApiError, McpToolError } from '@chrischall/mcp-utils';

// Load .env for local dev; silently skip if dotenv is unavailable (e.g. the
// .mcpb bundle). loadDotenvSafely never lets .env override a host-provided value.
const __dirname = dirname(fileURLToPath(import.meta.url));
await loadDotenvSafely({ path: join(__dirname, '..', '.env'), override: false });

const BASE_URL = 'https://api.viator.com/partner';
const SERVICE = 'Viator Partner API';
// Every call must pin the API version via the Accept header or Viator answers
// 400. POST bodies use the same versioned media type.
const VERSIONED_JSON = 'application/json;version=2.0';
// Viator's own endpoint budget for its slowest endpoints is generous; searches
// normally return in a few seconds. 60s leaves room without hanging a host.
const REQUEST_TIMEOUT_MS = 60_000;
// Viator rate-limits per endpoint on a rolling 10s window (e.g. 16 req/10s) and
// answers 429/503 with Retry-After. A short-TTL response cache absorbs an agent
// re-issuing the same search. Override with VIATOR_CACHE_TTL (seconds; 0 = off).
const DEFAULT_CACHE_TTL_MS = 60_000;
// Reference data (destinations, tags, locations, exchange rates) barely
// changes; it gets a 1h default TTL. Override with VIATOR_STATIC_CACHE_TTL
// (seconds; 0 = off). Tools opt in via { cache: 'static' }.
const DEFAULT_STATIC_CACHE_TTL_MS = 3_600_000;
// Bound the cache so a long-lived server doesn't grow unbounded; oldest first.
const CACHE_MAX_ENTRIES = 256;
// Honor Retry-After on 429/503, but never sleep absurdly long inside a tool call.
const MAX_RETRY_AFTER_MS = 30_000;

/** Resolve a cache TTL (ms) from an env var holding seconds. A blank or
 * non-numeric value falls back to `defaultMs`; a valid `0` disables caching. */
function readCacheTtlMs(envVar: string, defaultMs: number): number {
  const raw = readEnvVar(envVar);
  if (raw === undefined) return defaultMs;
  const secs = Number(raw);
  return Number.isFinite(secs) && secs >= 0 ? secs * 1000 : defaultMs;
}

export interface ViatorClientOptions {
  /** API key; when the property is absent, read from VIATOR_API_KEY. */
  apiKey?: string;
  /** Accept-Language value; default VIATOR_LANGUAGE or en-US. */
  language?: string;
  fetchImpl?: typeof fetch;
  cacheTtlMs?: number;
  staticCacheTtlMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class ViatorClient {
  private readonly apiKey: string | null;
  private readonly configError: Error | null;
  private readonly language: string;
  private readonly fetchImpl: typeof fetch;
  private readonly cacheTtlMs: number;
  private readonly staticCacheTtlMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly cache = new Map<string, { expiresAt: number; value: unknown }>();

  /**
   * Defer the config error so the server still boots (and answers the host's
   * install-time tools/list probe) when VIATOR_API_KEY isn't set yet. The
   * error is re-raised at request time via requireKey().
   */
  constructor(opts: ViatorClientOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.cacheTtlMs = opts.cacheTtlMs ?? readCacheTtlMs('VIATOR_CACHE_TTL', DEFAULT_CACHE_TTL_MS);
    this.staticCacheTtlMs =
      opts.staticCacheTtlMs ?? readCacheTtlMs('VIATOR_STATIC_CACHE_TTL', DEFAULT_STATIC_CACHE_TTL_MS);
    this.language = opts.language ?? readEnvVar('VIATOR_LANGUAGE') ?? 'en-US';
    // `'apiKey' in opts` (not `?? readEnvVar(...)`) so tests can force the
    // missing-key path with an explicit undefined even when .env has a key.
    const key = 'apiKey' in opts ? opts.apiKey : readEnvVar('VIATOR_API_KEY');
    if (!key) {
      this.apiKey = null;
      this.configError = new McpToolError('VIATOR_API_KEY environment variable is required', {
        hint: 'Sign up as a Viator partner (Basic Access affiliate is free) at https://partnerresources.viator.com/ and set VIATOR_API_KEY in your MCP host env or .env.',
      });
    } else {
      this.apiKey = key;
      this.configError = null;
    }
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private requireKey(): string {
    if (this.configError) throw this.configError;
    return this.apiKey!;
  }

  /** GET a JSON resource; `path` must already include any query string. */
  async get<T = unknown>(path: string, opts: { cache?: 'dynamic' | 'static' } = {}): Promise<T> {
    return this.request<T>('GET', path, undefined, opts);
  }

  /** POST a JSON body. Viator's search/read endpoints are POSTs, so responses
   * are cached just like GETs, keyed by path + serialized body. */
  async post<T = unknown>(path: string, body: unknown, opts: { cache?: 'dynamic' | 'static' } = {}): Promise<T> {
    return this.request<T>('POST', path, body, opts);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    opts: { cache?: 'dynamic' | 'static' },
  ): Promise<T> {
    const key = this.requireKey();
    const ttl = opts.cache === 'static' ? this.staticCacheTtlMs : this.cacheTtlMs;
    const cacheKey = `${method} ${path}${body === undefined ? '' : ' ' + JSON.stringify(body)}`;
    if (ttl > 0) {
      const hit = this.cache.get(cacheKey);
      if (hit && hit.expiresAt > this.now()) return hit.value as T;
    }

    const headers: Record<string, string> = {
      'exp-api-key': key,
      Accept: VERSIONED_JSON,
      'Accept-Language': this.language,
    };
    const init: RequestInit = { method, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
    if (body !== undefined) {
      headers['Content-Type'] = VERSIONED_JSON;
      init.body = JSON.stringify(body);
    }

    let res = await this.fetchImpl(`${BASE_URL}${path}`, init);
    // Viator signals rate limiting with 429 (per-endpoint window) and 503
    // (system-wide concurrency), both carrying Retry-After seconds. Honor it
    // once, capped so a tool call never sleeps unreasonably long.
    if (res.status === 429 || res.status === 503) {
      const retryAfterSec = Number(res.headers.get('retry-after'));
      const delayMs = Math.min(
        Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 1000,
        MAX_RETRY_AFTER_MS,
      );
      await this.sleep(delayMs);
      res = await this.fetchImpl(`${BASE_URL}${path}`, init);
    }

    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new McpToolError(
        `${SERVICE} returned ${res.status} — either VIATOR_API_KEY is invalid, or your key's access tier does not include this endpoint (this server targets the Basic Access affiliate tier).`,
        { hint: 'Check your key in the Viator partner portal (https://partnerresources.viator.com/).' },
      );
    }
    if (res.status === 429 || res.status === 503) {
      throw new McpToolError(`${SERVICE} rate limit: still receiving ${res.status} Too Many Requests after a retry.`, {
        hint: 'Viator rate-limits each endpoint per rolling 10s window. Space out calls, or rely on the built-in response cache (VIATOR_CACHE_TTL).',
      });
    }
    if (!res.ok) {
      throw new McpToolError(formatApiError(res.status, method, path, text, { service: SERVICE }));
    }
    const value = (text.trim() ? JSON.parse(text) : undefined) as T;

    if (ttl > 0) {
      if (this.cache.size >= CACHE_MAX_ENTRIES) {
        // Evict expired entries first; if still full, drop the oldest (Map
        // preserves insertion order, so the first key is the oldest).
        const t = this.now();
        for (const [k, v] of this.cache) if (v.expiresAt <= t) this.cache.delete(k);
        while (this.cache.size >= CACHE_MAX_ENTRIES) {
          const oldest = this.cache.keys().next().value;
          if (oldest === undefined) break;
          this.cache.delete(oldest);
        }
      }
      this.cache.set(cacheKey, { expiresAt: this.now() + ttl, value });
    }
    return value;
  }
}

/**
 * Module-level singleton shared by every tool module. Constructed here (not in
 * index.ts) so the deferred-config-error pattern holds: the server boots and
 * lists tools even without a key — the error surfaces on the first tool call.
 */
export const client = new ViatorClient();
