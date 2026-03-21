/**
 * DB Schema Introspection Controller
 * Returns all tables, columns, and foreign key relations in one call
 */

// ===== MODELS & DATABASE =====
const { sequelize } = require('../models');

// ===== ERROR & RESPONSE HANDLING =====
const { asyncHandler } = require('../utils/errors');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/**
 * Get full database schema with tables, columns, and foreign keys
 * GET /api/v1/schema
 */
const getFullSchema = asyncHandler(async (req, res, next) => {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  const schema = {};

  for (const table of tables) {
    // Columns
    const columns = await queryInterface.describeTable(table);
    // Foreign keys
    let relations = [];
    try {
      relations = await queryInterface.getForeignKeyReferencesForTable(table);
    } catch (e) {
      // Not all dialects support this, fallback to empty
    }
    schema[table] = { columns, relations };
  }

  return sendSuccess(res, {
    tables: schema
  });
});

module.exports = { getFullSchema };