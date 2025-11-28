/**
 * Jest Test Setup
 * Configure test environment before running tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3099'; // Use a different port for testing
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
process.env.DB_DIALECT = 'sqlite';
process.env.DATABASE_PATH = './data/test.db';

// Set a longer timeout for integration tests
jest.setTimeout(30000);

// Suppress console logs during tests (optional - comment out to see logs)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   info: jest.fn(),
//   debug: jest.fn(),
// };
