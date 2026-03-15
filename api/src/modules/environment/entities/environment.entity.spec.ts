import { PontifexEnvironmentFromGremlin, isAddPasswordDto } from './environment.entity';

describe('PontifexEnvironmentFromGremlin', () => {
  it('converts a gremlin vertex to a PontifexEnvironment', () => {
    const vertex = {
      id: 'env-1',
      label: 'environment',
      properties: [
        { key: 'name', value: 'my-app-dev' },
        { key: 'level', value: 'dev' },
        { key: 'clientId', value: 'client-123' },
        { key: 'spaRedirectUrls', value: 'http://localhost:3000,http://localhost:4000' },
        { key: 'webRedirectUrls', value: 'http://api.example.com/callback' },
      ],
    };

    const result = PontifexEnvironmentFromGremlin(vertex);

    expect(result).toEqual({
      id: 'env-1',
      name: 'my-app-dev',
      level: 'dev',
      clientId: 'client-123',
      spaRedirectUrls: ['http://localhost:3000', 'http://localhost:4000'],
      webRedirectUrls: ['http://api.example.com/callback'],
    });
  });

  it('returns empty arrays when redirect URLs are empty strings', () => {
    const vertex = {
      id: 'env-1',
      label: 'environment',
      properties: [
        { key: 'name', value: 'app-prod' },
        { key: 'level', value: 'prod' },
        { key: 'clientId', value: 'client-456' },
        { key: 'spaRedirectUrls', value: '' },
        { key: 'webRedirectUrls', value: '' },
      ],
    };

    const result = PontifexEnvironmentFromGremlin(vertex);
    expect(result.spaRedirectUrls).toEqual([]);
    expect(result.webRedirectUrls).toEqual([]);
  });

  it('falls back to redirectUrls for spaRedirectUrls when not migrated', () => {
    const vertex = {
      id: 'env-1',
      label: 'environment',
      properties: [
        { key: 'name', value: 'app-legacy' },
        { key: 'level', value: 'dev' },
        { key: 'clientId', value: 'client-789' },
        { key: 'redirectUrls', value: 'http://legacy.example.com' },
      ],
    };

    const result = PontifexEnvironmentFromGremlin(vertex);
    expect(result.spaRedirectUrls).toEqual(['http://legacy.example.com']);
    expect(result.webRedirectUrls).toEqual([]);
  });

  it('uses spaRedirectUrls over redirectUrls when migrated', () => {
    const vertex = {
      id: 'env-1',
      label: 'environment',
      properties: [
        { key: 'name', value: 'app-migrated' },
        { key: 'level', value: 'dev' },
        { key: 'clientId', value: 'client-abc' },
        { key: 'redirectUrls', value: 'http://old.example.com' },
        { key: 'spaRedirectUrls', value: 'http://new.example.com' },
        { key: 'webRedirectUrls', value: '' },
      ],
    };

    const result = PontifexEnvironmentFromGremlin(vertex);
    expect(result.spaRedirectUrls).toEqual(['http://new.example.com']);
  });
});

describe('isAddPasswordDto', () => {
  it('returns true for valid AddPasswordDto', () => {
    expect(isAddPasswordDto({ displayName: 'my-secret' })).toBe(true);
  });

  it('returns false when displayName is missing', () => {
    expect(isAddPasswordDto({})).toBe(false);
  });

  it('returns false when displayName is not a string', () => {
    expect(isAddPasswordDto({ displayName: 123 })).toBe(false);
  });
});
