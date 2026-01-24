'use strict';

/**
 * Migration: Update tanks fuel_type enum to include all fuel types
 * 
 * The original schema used ENUM('Petrol', 'Diesel') but the app constants
 * have expanded to include premium_petrol, premium_diesel, cng, lpg, ev_charging.
 * 
 * This migration:
 * 1. Drops the old enum constraint
 * 2. Changes column to VARCHAR to allow all fuel types
 * 3. Updates any 'Petrol' -> 'petrol' and 'Diesel' -> 'diesel' case mismatches
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if we're using PostgreSQL
      const dialect = queryInterface.sequelize.getDialect();
      
      if (dialect === 'postgres') {
        // PostgreSQL: Need to handle ENUM types carefully
        // First, check if the column is using an ENUM or VARCHAR
        const [columns] = await queryInterface.sequelize.query(`
          SELECT data_type, udt_name 
          FROM information_schema.columns 
          WHERE table_name = 'tanks' AND column_name = 'fuel_type'
        `, { transaction });
        
        if (columns.length > 0 && columns[0].data_type === 'USER-DEFINED') {
          // Column is using an ENUM, need to convert to VARCHAR
          console.log('Converting fuel_type from ENUM to VARCHAR...');
          
          // Create a temporary column with VARCHAR type
          await queryInterface.addColumn('tanks', 'fuel_type_new', {
            type: Sequelize.STRING(30),
            allowNull: true
          }, { transaction });
          
          // Copy data with case conversion (cast enum to text first, then lowercase)
          await queryInterface.sequelize.query(`
            UPDATE tanks SET fuel_type_new = LOWER(fuel_type::text)
          `, { transaction });
          
          // Drop old column
          await queryInterface.removeColumn('tanks', 'fuel_type', { transaction });
          
          // Rename new column
          await queryInterface.renameColumn('tanks', 'fuel_type_new', 'fuel_type', { transaction });
          
          // Set NOT NULL
          await queryInterface.changeColumn('tanks', 'fuel_type', {
            type: Sequelize.STRING(30),
            allowNull: false
          }, { transaction });
          
          // Drop the old enum type if it exists
          await queryInterface.sequelize.query(`
            DROP TYPE IF EXISTS "enum_tanks_fuel_type" CASCADE
          `, { transaction });
          
          console.log('✅ Successfully converted fuel_type to VARCHAR');
        } else {
          console.log('fuel_type is already VARCHAR, no conversion needed');
          
          // Just normalize case - column is already VARCHAR
          await queryInterface.sequelize.query(`
            UPDATE tanks SET fuel_type = LOWER(fuel_type) WHERE fuel_type IN ('Petrol', 'Diesel')
          `, { transaction });
        }
      } else {
        // SQLite/MySQL: Just normalize case, no enum issues
        await queryInterface.sequelize.query(`
          UPDATE tanks SET fuel_type = LOWER(fuel_type) WHERE fuel_type IN ('Petrol', 'Diesel')
        `, { transaction });
      }
      
      await transaction.commit();
      console.log('✅ Migration completed successfully');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // This migration is not easily reversible as we're expanding the allowed values
    // Just log a warning
    console.log('⚠️ Down migration: fuel_type column type change cannot be easily reverted');
  }
};
