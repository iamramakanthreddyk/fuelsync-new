'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Migration: Add is_sample field to nozzle_readings table
     * Purpose: Mark sample/test readings taken for quality checks
     * 
     * When is_sample = true:
     * - Reading still moves meter forward (for continuity)
     * - Fuel is NOT deducted from tank level
     * - Reading is NOT included in sales totals
     * - Reading is NOT included in profit calculations
     * - Owner can see count per day
     */
    
    await queryInterface.addColumn('nozzle_readings', 'is_sample', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'If true, meter moved but fuel returned to tank. Excluded from sales calculations.'
    });

    // Add index for efficient filtering of sample readings
    await queryInterface.addIndex('nozzle_readings', {
      fields: ['station_id', 'reading_date', 'is_sample'],
      name: 'idx_nozzle_readings_sample'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('nozzle_readings', 'idx_nozzle_readings_sample');
    await queryInterface.removeColumn('nozzle_readings', 'is_sample');
  }
};
