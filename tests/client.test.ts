import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EdgeBlockedError, McpToolError } from '@chrischall/mcp-utils';
import { ViatorClient } from '../src/client.js';

// ViatorClient falls through to VIATOR_* env vars (VIATOR_API_BASE_URL,
// VIATOR_LANGUAGE, VIATOR_API_KEY, cache TTLs) when the constructor opts
// omit them, and `src/client.ts` loads a repo-local `.env` at import. A
// developer whose `.env` points VIATOR_API_BASE_URL at the sandbox would
// otherwise see the "production host" assertions fail (green in CI, red
// locally). Neutralise the ambient env per test; tests that need a value
// pass it via opts.
const VIATOR_ENV_VARS = [
  'VIATOR_API_BASE_URL',
  'VIATOR_API_KEY',
  'VIATOR_LANGUAGE',
  'VIATOR_CACHE_TTL',
  'VIATOR_STATIC_CACHE_TTL',
] as const;
const savedViatorEnv: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of VIATOR_ENV_VARS) {
    savedViatorEnv[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of VIATOR_ENV_VARS) {
    if (savedViatorEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedViatorEnv[k];
  }
});

/** Build a Response-like object for the mocked fetch. */
function jsonRes(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json;version=2.0', ...headers },
  });
}

function makeClient(
  fetchImpl: typeof fetch,
  opts: Partial<ConstructorParameters<typeof ViatorClient>[0]> = {},
) {
  return new ViatorClient({
    apiKey: 'test-key',
    fetchImpl,
    now: () => 1_000_000,
    sleep: async () => {},
    ...opts,
  });
}

describe('ViatorClient', () => {
  it('sends exp-api-key, versioned Accept, and Accept-Language on GET', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200, { ok: true }));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await client.get('/destinations');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.viator.com/partner/destinations');
    expect(init.headers['exp-api-key']).toBe('test-key');
    expect(init.headers['Accept']).toBe('application/json;version=2.0');
    expect(init.headers['Accept-Language']).toBe('en-US');
    expect(init.method).toBe('GET');
  });

  it('sends a JSON body with Content-Type on POST', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200, { products: [] }));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await client.post('/products/search', { searchTerm: 'rome' });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json;version=2.0');
    expect(JSON.parse(init.body)).toEqual({ searchTerm: 'rome' });
  });

  it('defers a missing-key error to the first request, not construction', async () => {
    const fetchImpl = vi.fn();
    const client = new ViatorClient({ apiKey: undefined, fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.get('/destinations')).rejects.toThrow(/VIATOR_API_KEY/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('caches identical GETs within the TTL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200, { n: 1 }));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await client.get('/products/tags', { cache: 'static' });
    await client.get('/products/tags', { cache: 'static' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('caches identical POSTs keyed by path + body', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => jsonRes(200, { products: [] }));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await client.post('/products/search', { searchTerm: 'rome' });
    await client.post('/products/search', { searchTerm: 'rome' });
    await client.post('/products/search', { searchTerm: 'paris' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("bypasses the cache entirely with cache: 'none', even over a warm cached entry", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => jsonRes(200, { rates: [] }));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    const body = { sourceCurrencies: ['USD'], targetCurrencies: ['EUR'] };
    await client.post('/exchange-rates', body, { cache: 'static' });
    await client.post('/exchange-rates', body, { cache: 'none' });
    await client.post('/exchange-rates', body, { cache: 'none' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // An uncached call must not populate the cache either.
    await client.get('/products/tags', { cache: 'none' });
    await client.get('/products/tags', { cache: 'static' });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('does not cache when TTL is 0', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => jsonRes(200, { n: 1 }));
    const client = makeClient(fetchImpl as unknown as typeof fetch, { cacheTtlMs: 0 });
    await client.get('/destinations');
    await client.get('/destinations');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries once on 429, honoring Retry-After', async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRes(429, { code: 'TOO_MANY_REQUESTS' }, { 'Retry-After': '3' }))
      .mockResolvedValueOnce(jsonRes(200, { ok: true }));
    const client = makeClient(fetchImpl as unknown as typeof fetch, { sleep });
    const data = await client.get<{ ok: boolean }>('/destinations');
    expect(data.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it('retries once on 503, honoring Retry-After', async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(jsonRes(200, { ok: true }));
    const client = makeClient(fetchImpl as unknown as typeof fetch, { sleep });
    await client.get('/destinations');
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('caps a huge Retry-After and surfaces 429 after the retry also fails', async () => {
    const sleep = vi.fn(async () => {});
    // A fresh Response per call — a body can only be read once.
    const fetchImpl = vi
      .fn()
      .mockImplementation(async () => jsonRes(429, { code: 'TOO_MANY_REQUESTS' }, { 'Retry-After': '9999' }));
    const client = makeClient(fetchImpl as unknown as typeof fetch, { sleep });
    await expect(client.get('/destinations')).rejects.toThrow(/rate.limit|429|Too Many/i);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // capped at 30s, never 9999s
    expect(sleep.mock.calls[0][0]).toBeLessThanOrEqual(30_000);
  });

  it('names both causes on 401 (bad key or not-yet-active key)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(401, { code: 'UNAUTHORIZED' }));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.get('/destinations')).rejects.toThrow(/key/i);
  });

  it('surfaces the response body on other HTTP errors', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonRes(400, { code: 'BAD_REQUEST', message: 'Invalid destination id' }));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.post('/products/search', {})).rejects.toThrow(/Invalid destination id/);
  });

  it('honors a baseUrl override (e.g. the sandbox host)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200, {}));
    const client = makeClient(fetchImpl as unknown as typeof fetch, {
      baseUrl: 'https://api.sandbox.viator.com/partner',
    });
    await client.get('/destinations');
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.sandbox.viator.com/partner/destinations');
  });

  it('strips a trailing slash from the baseUrl override', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200, {}));
    const client = makeClient(fetchImpl as unknown as typeof fetch, {
      baseUrl: 'https://api.sandbox.viator.com/partner/',
    });
    await client.get('/destinations');
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.sandbox.viator.com/partner/destinations');
  });

  it('reads language from the constructor and applies it to Accept-Language', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200, {}));
    const client = makeClient(fetchImpl as unknown as typeof fetch, { language: 'es' });
    await client.get('/destinations');
    expect(fetchImpl.mock.calls[0][1].headers['Accept-Language']).toBe('es');
  });

  it('expires cache entries after the TTL', async () => {
    let t = 0;
    const fetchImpl = vi.fn().mockImplementation(async () => jsonRes(200, { n: 1 }));
    const client = makeClient(fetchImpl as unknown as typeof fetch, {
      now: () => t,
      cacheTtlMs: 1000,
    });
    await client.get('/destinations');
    t = 500;
    await client.get('/destinations');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t = 1500;
    await client.get('/destinations');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  // ── Error contract, pinned exactly (fleet-audit #1134 moves the transport
  //    onto mcp-utils createApiClient). ──
  it('401 and 403 keep the exact key/access-tier message', async () => {
    for (const status of [401, 403]) {
      const fetchImpl = vi.fn().mockResolvedValue(jsonRes(status, { code: 'UNAUTHORIZED' }));
      const client = makeClient(fetchImpl as unknown as typeof fetch);
      const err = await client.get('/destinations').catch((e) => e);
      expect(err).toBeInstanceOf(McpToolError);
      expect(err.message).toBe(
        `Viator Partner API returned ${status} — either VIATOR_API_KEY is invalid, or your key's access tier does not include this endpoint (this server targets the Basic Access affiliate tier).`,
      );
      expect(err.hint).toMatch(/partner portal/);
    }
  });

  it('an exhausted 429 or 503 keeps the exact rate-limit message', async () => {
    for (const status of [429, 503]) {
      const fetchImpl = vi.fn().mockImplementation(async () => jsonRes(status, {}));
      const client = makeClient(fetchImpl as unknown as typeof fetch);
      const err = await client.get('/destinations').catch((e) => e);
      expect(err).toBeInstanceOf(McpToolError);
      expect(err.message).toBe(`Viator Partner API rate limit: still receiving ${status} Too Many Requests after a retry.`);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    }
  });

  it('other non-2xx keep the exact formatApiError message (no retry)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(400, { message: 'Invalid destination id' }));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    const err = await client.post('/products/search?x=1', {}).catch((e) => e);
    expect(err).toBeInstanceOf(McpToolError);
    expect(err.message).toBe('Viator Partner API error 400 for POST /products/search?x=1: {"message":"Invalid destination id"}');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sends exactly one versioned Content-Type on POST', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200, {}));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await client.post('/products/search', { a: 1 });
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    const h = new Headers(init.headers);
    expect(h.get('content-type')).toBe('application/json;version=2.0');
    expect(h.get('accept')).toBe('application/json;version=2.0');
    expect(init.body).toBe('{"a":1}');
  });

  it('names a CDN/WAF 429 page as an edge block even after the retry', async () => {
    const page = '<html><title>Attention Required! | Cloudflare</title>cf-ray</html>';
    const fetchImpl = vi
      .fn()
      .mockImplementation(async () => new Response(page, { status: 429, headers: { 'cf-mitigated': 'challenge' } }));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    const err = await client.get('/destinations').catch((e) => e);
    expect(err).toBeInstanceOf(EdgeBlockedError);
    expect(err.status).toBe(429);
  });

  it('wraps a network failure in an actionable McpToolError (#788)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    const err = await client.get('/destinations').catch((e) => e);
    expect(err).toBeInstanceOf(McpToolError);
    expect(err.message).toBe('Viator Partner API request failed: fetch failed.');
  });

  describe('timing (fake timers)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('waits exactly the Retry-After before the single retry', async () => {
      vi.useFakeTimers();
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(jsonRes(503, {}, { 'Retry-After': '5' }))
        .mockResolvedValueOnce(jsonRes(200, { ok: true }));
      const client = new ViatorClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
      const pending = client.get('/destinations');
      await vi.advanceTimersByTimeAsync(4_999);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual({ ok: true });
    });

    it('caps a huge Retry-After at 30s', async () => {
      vi.useFakeTimers();
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(jsonRes(429, {}, { 'Retry-After': '9999' }))
        .mockResolvedValueOnce(jsonRes(200, { ok: true }));
      const client = new ViatorClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
      const pending = client.get('/destinations');
      await vi.advanceTimersByTimeAsync(29_999);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual({ ok: true });
    });

    it('times a hung request out at 60s as an actionable McpToolError (#788)', async () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          }),
      );
      const client = new ViatorClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
      const pending = client.get('/destinations').catch((e) => e);
      await vi.advanceTimersByTimeAsync(59_999);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      const err = await pending;
      expect(err).toBeInstanceOf(McpToolError);
      expect(err.message).toBe('Viator Partner API request timed out after 60s.');
    });

    // #788: the retry used to inherit the first attempt's timeout signal. A
    // slow 503 (35s) + Retry-After: 30 aborted the retry before it was sent.
    it('gives the retry its own fresh 60s window after a slow first attempt', async () => {
      vi.useFakeTimers();
      let n = 0;
      const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
        n += 1;
        if (n === 1) {
          await new Promise((r) => setTimeout(r, 35_000));
          return jsonRes(503, {}, { 'Retry-After': '30' });
        }
        expect(init.signal?.aborted).toBe(false);
        return jsonRes(200, { ok: true });
      });
      const client = new ViatorClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
      const pending = client.get('/destinations');
      await vi.advanceTimersByTimeAsync(35_000 + 30_000);
      await expect(pending).resolves.toEqual({ ok: true });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
  });
});
