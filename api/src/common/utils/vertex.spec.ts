import { vertexToObject } from './vertex';

describe('vertexToObject', () => {
  it('converts a vertex with properties to a plain object', () => {
    const vertex = {
      id: 'v-1',
      label: 'application',
      properties: [
        { key: 'name', value: 'my-app' },
        { key: 'creator', value: 'user-1' },
      ],
    };

    expect(vertexToObject(vertex)).toEqual({
      id: 'v-1',
      label: 'application',
      name: 'my-app',
      creator: 'user-1',
    });
  });

  it('returns id and label when there are no properties', () => {
    const vertex = { id: 'v-1', label: 'user', properties: [] };
    expect(vertexToObject(vertex)).toEqual({ id: 'v-1', label: 'user' });
  });

  it('returns id and label when properties is undefined', () => {
    const vertex = { id: 'v-1', label: 'user' };
    expect(vertexToObject(vertex)).toEqual({ id: 'v-1', label: 'user' });
  });

  it('returns empty object for null input', () => {
    expect(vertexToObject(null)).toEqual({});
  });

  it('returns empty object for undefined input', () => {
    expect(vertexToObject(undefined)).toEqual({});
  });

  it('returns empty object for non-object input', () => {
    expect(vertexToObject('string')).toEqual({});
  });

  it('skips properties with undefined values', () => {
    const vertex = {
      id: 'v-1',
      label: 'test',
      properties: [
        { key: 'name', value: 'test' },
        { key: 'missing', value: undefined },
      ],
    };

    expect(vertexToObject(vertex)).toEqual({
      id: 'v-1',
      label: 'test',
      name: 'test',
    });
  });

  it('includes properties with falsy but defined values', () => {
    const vertex = {
      id: 'v-1',
      label: 'test',
      properties: [
        { key: 'count', value: 0 },
        { key: 'active', value: false },
        { key: 'tag', value: '' },
      ],
    };

    expect(vertexToObject(vertex)).toEqual({
      id: 'v-1',
      label: 'test',
      count: 0,
      active: false,
      tag: '',
    });
  });

  it('skips malformed property entries', () => {
    const vertex = {
      id: 'v-1',
      label: 'test',
      properties: [
        null,
        { value: 'no-key' },
        { key: 'valid', value: 'yes' },
      ],
    };

    expect(vertexToObject(vertex)).toEqual({
      id: 'v-1',
      label: 'test',
      valid: 'yes',
    });
  });
});
