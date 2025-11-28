/**
 * Jest Configuration for FuelSync Backend
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/_deprecated/'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Ensure tests run sequentially to avoid database conflicts
  maxWorkers: 1,
  // Setup file to configure environment
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
