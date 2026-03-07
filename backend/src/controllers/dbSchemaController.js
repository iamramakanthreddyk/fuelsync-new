/**
 * DB Schema Introspection Controller
 * Returns all tables, columns, and foreign key relations in one call
 */
const { sequelize } = require('../models');

async function getFullSchema(req, res) {
  try {
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

    res.json({ success: true, tables: schema });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { getFullSchema };