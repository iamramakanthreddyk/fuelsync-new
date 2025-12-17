'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add missing columns to tanks table to match the Tank model

    // Note: 'name' column already exists from baseline migration

    // Check existing columns
    const tableDescription = await queryInterface.describeTable('tanks');
    const hasCapacityLitres = 'capacity_litres' in tableDescription;
    const hasCurrentLitres = 'current_litres' in tableDescription;
    const hasIsActive = 'is_active' in tableDescription;

    // Rename capacity_litres to capacity if it exists
    if (hasCapacityLitres) {
      await queryInterface.renameColumn('tanks', 'capacity_litres', 'capacity');
    }

    // Rename current_litres to current_level if it exists
    if (hasCurrentLitres) {
      await queryInterface.renameColumn('tanks', 'current_litres', 'current_level');
    }

    // Add is_active column if it doesn't exist
    if (!hasIsActive) {
      await queryInterface.addColumn('tanks', 'is_active', {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      });
    }

    // Add other missing columns with existence checks
    const columnsToAdd = [
      { name: 'notes', definition: { type: Sequelize.TEXT, allowNull: true } },
      { name: 'low_level_warning', definition: { type: Sequelize.DECIMAL(12, 2), allowNull: true, comment: 'Litres at which to show low fuel warning' } },
      { name: 'critical_level_warning', definition: { type: Sequelize.DECIMAL(12, 2), allowNull: true, comment: 'Litres at which to show critical fuel warning' } },
      { name: 'low_level_percent', definition: { type: Sequelize.DECIMAL(5, 2), allowNull: true, defaultValue: 20, validate: { min: 0, max: 100 }, comment: 'Percentage of capacity for low warning' } },
      { name: 'critical_level_percent', definition: { type: Sequelize.DECIMAL(5, 2), allowNull: true, defaultValue: 10, validate: { min: 0, max: 100 }, comment: 'Percentage of capacity for critical warning' } },
      { name: 'last_dip_reading', definition: { type: Sequelize.DECIMAL(12, 2), allowNull: true, comment: 'Last physical dip stick measurement' } },
      { name: 'last_dip_date', definition: { type: Sequelize.DATEONLY, allowNull: true } },
      { name: 'tracking_mode', definition: { type: Sequelize.ENUM('strict', 'warning', 'disabled'), defaultValue: 'warning', comment: 'strict=block if insufficient, warning=warn only, disabled=no tracking' } },
      { name: 'allow_negative', definition: { type: Sequelize.BOOLEAN, defaultValue: false, comment: 'Allow level to go negative (for corrections)' } }
    ];

    for (const column of columnsToAdd) {
      if (!(column.name in tableDescription)) {
        await queryInterface.addColumn('tanks', column.name, column.definition);
      }
    }

    // Populate is_active based on status if the column was added
    if (!hasIsActive) {
      await queryInterface.sequelize.query(`
        UPDATE tanks
        SET is_active = CASE
          WHEN status = 'active' THEN true
          WHEN status = 'inactive' THEN false
          WHEN status = 'maintenance' THEN false
          ELSE true
        END
      `);
    }

    // Add indexes (check if they exist first)
    try {
      await queryInterface.addIndex('tanks', ['is_active'], {
        name: 'tanks_is_active'
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
      // Index already exists, continue
    }
  },

  async down (queryInterface, Sequelize) {
    // Remove indexes (check if they exist first)
    try {
      await queryInterface.removeIndex('tanks', 'tanks_is_active');
    } catch (error) {
      if (!error.message.includes('does not exist')) {
        throw error;
      }
      // Index doesn't exist, continue
    }

    // Remove added columns
    await queryInterface.removeColumn('tanks', 'allow_negative');
    await queryInterface.removeColumn('tanks', 'tracking_mode');
    await queryInterface.removeColumn('tanks', 'last_dip_date');
    await queryInterface.removeColumn('tanks', 'last_dip_reading');
    await queryInterface.removeColumn('tanks', 'critical_level_percent');
    await queryInterface.removeColumn('tanks', 'low_level_percent');
    await queryInterface.removeColumn('tanks', 'critical_level_warning');
    await queryInterface.removeColumn('tanks', 'low_level_warning');
    await queryInterface.removeColumn('tanks', 'notes');
    await queryInterface.removeColumn('tanks', 'is_active');

    // Check current column names for rollback
    const tableDescription = await queryInterface.describeTable('tanks');
    const hasCapacity = 'capacity' in tableDescription;
    const hasCurrentLevel = 'current_level' in tableDescription;

    // Rename columns back if they exist
    if (hasCapacity) {
      await queryInterface.renameColumn('tanks', 'capacity', 'capacity_litres');
    }
    if (hasCurrentLevel) {
      await queryInterface.renameColumn('tanks', 'current_level', 'current_litres');
    }

    // Note: 'name' column is not removed as it was part of baseline migration
  }
};