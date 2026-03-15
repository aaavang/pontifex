import { PontifexARoleFromGremlin } from './role.entity';

describe('PontifexARoleFromGremlin', () => {
  it('converts a gremlin vertex to a PontifexRole', () => {
    const vertex = {
      id: 'role-1',
      label: 'role',
      properties: [
        { key: 'name', value: 'admin' },
        { key: 'sensitive', value: true },
        { key: 'description', value: 'Admin role' },
      ],
    };

    const result = PontifexARoleFromGremlin(vertex);

    expect(result).toEqual({
      id: 'role-1',
      name: 'admin',
      sensitive: true,
      description: 'Admin role',
    });
  });

  it('defaults sensitive to false when missing', () => {
    const vertex = {
      id: 'role-2',
      label: 'role',
      properties: [{ key: 'name', value: 'reader' }],
    };

    const result = PontifexARoleFromGremlin(vertex);
    expect(result.sensitive).toBe(false);
  });

  it('defaults description to empty string when missing', () => {
    const vertex = {
      id: 'role-3',
      label: 'role',
      properties: [{ key: 'name', value: 'writer' }],
    };

    const result = PontifexARoleFromGremlin(vertex);
    expect(result.description).toBe('');
  });
});
