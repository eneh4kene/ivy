/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts', '**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Run setup before each test suite (sets env vars before env.ts is imported)
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Relax unused-variable errors in test files
        noUnusedLocals: false,
        noUnusedParameters: false,
      },
    }],
  },
  // Clear mocks between each test
  clearMocks: true,
  restoreMocks: true,
}
