import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.integration\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|gremlin)/)',
  ],
  testEnvironment: 'node',
  testTimeout: 30000,
  // Force gremlin to use the `ws` package instead of Node 22's native WebSocket
  globals: {},
  setupFiles: ['<rootDir>/modules/gremlin/gremlin-test-setup.ts'],
};

export default config;
