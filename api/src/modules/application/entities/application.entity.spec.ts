import { PontifexApplicationFromGremlin } from './application.entity';

describe('PontifexApplicationFromGremlin', () => {
  it('converts a gremlin vertex to a PontifexApplication', () => {
    const vertex = {
      id: 'app-1',
      label: 'application',
      properties: [
        { key: 'name', value: 'my-app' },
        { key: 'creator', value: 'user-1' },
        { key: 'description', value: 'A test app' },
      ],
    };

    const result = PontifexApplicationFromGremlin(vertex);

    expect(result).toEqual({
      id: 'app-1',
      name: 'my-app',
      creator: 'user-1',
      description: 'A test app',
    });
  });

  it('defaults description to empty string when missing', () => {
    const vertex = {
      id: 'app-1',
      label: 'application',
      properties: [
        { key: 'name', value: 'my-app' },
        { key: 'creator', value: 'user-1' },
      ],
    };

    const result = PontifexApplicationFromGremlin(vertex);
    expect(result.description).toBe('');
  });
});
