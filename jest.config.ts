import type { Config } from 'jest';

const config: Config = {
  projects: [
    // UNIT TESTS
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      moduleFileExtensions: ['js', 'json', 'ts'],
      rootDir: '.',
      testEnvironment: 'node',
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
      },
      moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
        '^test/(.*)$': '<rootDir>/test/$1',
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      setupFiles: ['<rootDir>/test/setup-unit.ts'],
    },
    // INTEGRATION TESTS
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      moduleFileExtensions: ['js', 'json', 'ts'],
      rootDir: '.',
      testEnvironment: 'node',
      transform: {
        '^.+\\.(ts|js)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
      },
      moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
        '^test/(.*)$': '<rootDir>/test/$1',
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      transformIgnorePatterns: [],
      // Integration tests need longer timeouts for container startup
      testTimeout: 60_000,
      setupFiles: ['<rootDir>/test/setup-integration.ts'],
      // Run integration tests serially to avoid container port conflicts
      maxWorkers: 1,
    },
  ],

  // ── Coverage ──
  collectCoverageFrom: [
    'src/**/*.ts',
    // Exclude things we don't need to cover
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.constant*.ts',
    '!src/**/*.enum.ts',
    '!src/generated/**',
    '!src/main.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Set thresholds — fails the build if coverage drops below these
  coverageThreshold: {
    global: {
      branches: 8,
      functions: 5,
      lines: 10,
      statements: 10,
    },
    // Stricter thresholds on critical services
    'src/conversation/services/': {
      branches: 20,
      functions: 45,
      lines: 40,
      statements: 40,
    },
    'src/query-cache/': {
      branches: 75,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
};
export default config;
