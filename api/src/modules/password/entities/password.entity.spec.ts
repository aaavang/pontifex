import { PontifexPasswordFromGremlin } from './password.entity';

describe('PontifexPasswordFromGremlin', () => {
  it('converts a gremlin vertex to a PontifexPassword', () => {
    const vertex = {
      id: 'pw-1',
      label: 'password',
      properties: [
        { key: 'displayName', value: 'my-secret' },
        { key: 'start', value: '2024-01-01' },
        { key: 'end', value: '2025-01-01' },
        { key: 'password', value: 'secret-value' },
      ],
    };

    const result = PontifexPasswordFromGremlin(vertex);

    expect(result).toEqual({
      id: 'pw-1',
      displayName: 'my-secret',
      start: '2024-01-01',
      end: '2025-01-01',
      password: 'secret-value',
    });
  });
});
