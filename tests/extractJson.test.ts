import { describe, it, expect } from 'vitest';
import { extractJson } from '../server/routes/ai.js';

describe('extractJson', () => {
  it('parses a plain JSON object', () => {
    const result = extractJson('{"a":1}');
    expect(result).toEqual({ a: 1 });
  });

  it('parses JSON wrapped in markdown fences', () => {
    const result = extractJson('Here you go:\n```json\n{"a": [1,2]}\n```\nDone.');
    expect(result).toEqual({ a: [1, 2] });
  });

  it('parses JSON embedded in surrounding prose', () => {
    const result = extractJson('Sure! {"topic":"Photosynthesis","ok":true} hope that helps');
    expect(result).toEqual({ topic: 'Photosynthesis', ok: true });
  });

  it('throws when no JSON is present', () => {
    expect(() => extractJson('no json here at all')).toThrow();
  });

  it('throws on empty input', () => {
    expect(() => extractJson('')).toThrow();
    expect(() => extractJson(undefined as unknown as string)).toThrow();
  });
});
