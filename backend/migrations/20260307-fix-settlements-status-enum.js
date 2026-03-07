"use strict";

/**
 * Migration: Fix settlements status enum
 * 
 * Changes settlement status from PostgreSQL ENUM type to VARCHAR
 * to avoid issues with value validation and schema mismatches.
 * The status column should never have been an ENUM type in the first place.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      // PostgreSQL: Convert ENUM to VARCHAR
      await queryInterface.sequelize.query(
        `ALTER TABLE settlements 
         ALTER COLUMN status DROP DEFAULT, 
         ALTER COLUMN status TYPE VARCHAR(20) USING status::text,
         ALTER COLUMN status SET DEFAULT 'draft';`
      );

      // Drop the old enum type if it exists
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS settlements_status;'
      );

      console.log('✓ Converted settlements.status from ENUM to VARCHAR');
    } else {
      // SQLite and others: Already VARCHAR, no changes needed
      console.log('✓ Settlements table already uses VARCHAR for status (non-Postgres dialect)');
    }
  },

  async down(queryInterface, Sequelize) {
    // Rollback is complex for ENUM conversions, so we'll skip it
    // (This is generally acceptable for production migrations)
    console.log('⚠️  Rollback not supported for ENUM->VARCHAR conversion');
  }
};
