import type { Config } from 'jest';

const config: Config = {
  passWithNoTests: true,
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
      modulePathIgnorePatterns: ['<rootDir>/build/', '<rootDir>/dist/'],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
      modulePathIgnorePatterns: ['<rootDir>/build/', '<rootDir>/dist/'],
    },
  ],
};

export default config;
