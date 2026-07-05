import { describe, it, expect, vi } from 'vitest';
import { ViatorClient } from '../src/client.js';

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
});
