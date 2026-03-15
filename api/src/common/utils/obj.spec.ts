import { omit, mapToObject } from './obj';

describe('omit', () => {
  it('removes specified fields from an object', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(omit(obj, 'b')).toEqual({ a: 1, c: 3 });
  });

  it('removes multiple fields', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    expect(omit(obj, 'a', 'c')).toEqual({ b: 2, d: 4 });
  });

  it('returns a copy when no fields are specified', () => {
    const obj = { a: 1, b: 2 };
    const result = omit(obj);
    expect(result).toEqual({ a: 1, b: 2 });
    expect(result).not.toBe(obj);
  });

  it('ignores fields that do not exist', () => {
    const obj = { a: 1 };
    expect(omit(obj, 'z')).toEqual({ a: 1 });
  });

  it('returns empty object for empty input', () => {
    expect(omit({})).toEqual({});
  });
});

describe('mapToObject', () => {
  it('converts a Map to a plain object', () => {
    const map = new Map<string, any>([
      ['name', 'test'],
      ['value', 42],
    ]);
    expect(mapToObject(map)).toEqual({ name: 'test', value: 42 });
  });

  it('handles nested Maps recursively', () => {
    const inner = new Map([['key', 'val']]);
    const outer = new Map([['nested', inner]]);
    expect(mapToObject(outer)).toEqual({ nested: { key: 'val' } });
  });

  it('handles arrays within Maps', () => {
    const map = new Map([['items', [1, 2, 3]]]);
    expect(mapToObject(map)).toEqual({ items: [1, 2, 3] });
  });

  it('handles arrays of Maps', () => {
    const map1 = new Map([['a', 1]]);
    const map2 = new Map([['b', 2]]);
    expect(mapToObject([map1, map2])).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('normalizes EnumValue keys', () => {
    const enumKey = { elementName: 'id' };
    const map = new Map([[enumKey, 'test-id']]);
    expect(mapToObject(map)).toEqual({ id: 'test-id' });
  });

  it('returns primitives as-is', () => {
    expect(mapToObject('hello')).toBe('hello');
    expect(mapToObject(42)).toBe(42);
    expect(mapToObject(null)).toBe(null);
    expect(mapToObject(undefined)).toBe(undefined);
  });

  it('returns plain objects as-is', () => {
    const obj = { a: 1 };
    expect(mapToObject(obj)).toBe(obj);
  });
});
