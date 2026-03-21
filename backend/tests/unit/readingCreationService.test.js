/**
 * Test: Reading Creation Service Refactoring
 * Verifies the separation of concerns in reading creation
 */

const readingCreationService = require('../../src/services/readingCreationService');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError, 
  BusinessLogicError 
} = require('../../src/utils/errors');

describe('Reading Creation Service - Refactoring Validation', () => {
  
  test('Service exports createReading function', () => {
    expect(typeof readingCreationService.createReading).toBe('function');
  });

  test('Error classes are correctly imported', () => {
    expect(ValidationError).toBeDefined();
    expect(NotFoundError).toBeDefined();
    expect(ConflictError).toBeDefined();
    expect(BusinessLogicError).toBeDefined();
  });

  test('Service exports only createReading (single responsibility)', () => {
    const exports = Object.keys(readingCreationService);
    expect(exports).toEqual(['createReading']);
  });

});
