import { PontifexUserFromGremlin } from './user.entity';

describe('PontifexUserFromGremlin', () => {
  it('converts a gremlin vertex to a PontifexUser', () => {
    const vertex = {
      id: 'user-1',
      label: 'user',
      properties: [
        { key: 'name', value: 'John Doe' },
        { key: 'email', value: 'john@example.com' },
        { key: 'normalizedName', value: 'john doe' },
      ],
    };

    const result = PontifexUserFromGremlin(vertex);

    expect(result).toEqual({
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
      normalizedName: 'john doe',
    });
  });
});
