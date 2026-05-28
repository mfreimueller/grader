/** @type {import('jest').Config} */
const config = {
  passWithNoTests: true,
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
      modulePathIgnorePatterns: ['<rootDir>/build/', '<rootDir>/dist/'],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
      modulePathIgnorePatterns: ['<rootDir>/build/', '<rootDir>/dist/'],
    },
  ],
};

module.exports = config;
