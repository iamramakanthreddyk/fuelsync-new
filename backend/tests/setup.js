/**
 * Jest Test Setup
 * Configure test environment BEFORE any tests run
 * This file sets up the test database and environment variables
 */

const path = require('path');
const fs = require('fs');

// CRITICAL: Set test environment FIRST, before anything else loads
process.env.NODE_ENV = 'test';
process.env.PORT = '3099';
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
process.env.DB_DIALECT = 'sqlite';

// Set test database path BEFORE models are loaded
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test.db');
process.env.DATABASE_PATH = TEST_DB_PATH;

console.log('🧪 [TEST SETUP] Node Environment:', process.env.NODE_ENV);
console.log('🧪 [TEST SETUP] Database Path:', process.env.DATABASE_PATH);
console.log('🧪 [TEST SETUP] Database Dialect:', process.env.DB_DIALECT);

// Ensure data directory exists
const dataDir = path.dirname(TEST_DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('📁 [TEST SETUP] Created test data directory');
}

// Remove old test database if exists (fresh start for each test run)
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
  console.log('🧹 [TEST SETUP] Cleaned up old test database');
}

// Set test-specific timeout
jest.setTimeout(30000);

// Optional: Suppress console logs during tests (uncomment to reduce noise)
// const originalLog = console.log;
// const originalError = console.error;
// console.log = jest.fn((...args) => {
//   if (!args[0]?.includes?.('[MODELS]') && !args[0]?.includes?.('[SYNC]')) {
//     originalLog(...args);
//   }
// });
// console.error = jest.fn((...args) => {
//   if (!args[0]?.includes?.('[MODELS]') && !args[0]?.includes?.('[SYNC]')) {
//     originalError(...args);
//   }
// });

console.log('✅ [TEST SETUP] Test environment configured');

