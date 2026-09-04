import { describe, it, expect } from 'vitest';
import { viewResponse, VIATOR_VIEWS } from '../src/view.js';

const parse = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text);

describe('the rungs', () => {
  it('offers compact and full, and not raw — full already IS the upstream payload', () => {
    expect(VIATOR_VIEWS).toEqual(['compact', 'full']);
  });

  it('defaults to compact when no view is given', () => {
    const data = { id: 1, photo: 'https://cdn/x.png' };
    expect(parse(viewResponse(undefined, data))).toEqual({ id: 1 });
  });
});

describe('what compact does — and what it deliberately does not', () => {
  it('strips image and avatar URLs', () => {
    const data = { users: [{ id: 7, name: 'A', avatar: 'https://cdn/a.png', photoUrl: 'https://cdn/b.jpg' }] };
    expect(parse(viewResponse('compact', data))).toEqual({ users: [{ id: 7, name: 'A' }] });
  });

  it('keeps EVERY other field on a tool with no projection of its own', () => {
    // Media stripping is subtractive and names no fields, so it cannot put a
    // hole in a record. The eight tools that run it have their shapes pinned in
    // docs/VIATOR-API.md — nobody has written and MEASURED a projection for
    // them yet, which is a backlog item, not a claim that their fields are
    // unknowable. The two ProductSummary tools do have one; see
    // tests/tools/products.test.ts and tests/tools/search.test.ts.
    const record = {
      productCode: 'P1', title: 'Tour', duration: { fixedDurationInMinutes: 120 }, pricing: { summary: { fromPrice: 49 } }, flags: [], cancellationPolicy: null,
      somethingNobodyAnticipated: 'kept',
    };
    expect(parse(viewResponse('compact', { data: [record] }))).toEqual({ data: [record] });
  });

  it('keeps null — an absent key and a null one are different facts', () => {
    expect(parse(viewResponse('compact', { endedAt: null }))).toEqual({ endedAt: null });
  });

  it('keeps a page URL', () => {
    const d = { link: 'https://www.viator.com/tours/P1' };
    expect(parse(viewResponse('compact', d))).toEqual(d);
  });
});

describe('full', () => {
  it('returns the payload untouched, images included', () => {
    const data = { id: 1, photo: 'https://cdn/x.png' };
    expect(parse(viewResponse('full', data))).toEqual(data);
  });
});

describe('whitespace', () => {
  it('emits none of its own, and never touches whitespace inside a value', () => {
    const description = 'Line one.\n\n  Indented.   ';
    const text = viewResponse('compact', { description }).content[0].text;
    expect(text.split('\n')).toHaveLength(1);
    expect(JSON.parse(text).description).toBe(description);
  });
});
