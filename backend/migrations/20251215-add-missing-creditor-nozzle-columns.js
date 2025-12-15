/**
 * Migration: Add missing columns to creditors and nozzles tables
 * Fixes 500 errors for missing fields in API queries
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Creditors table columns
    await queryInterface.addColumn('creditors', 'last_transaction_date', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('creditors', 'last_payment_date', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('creditors', 'aging_0_to_30', {
      type: Sequelize.DECIMAL(12,2),
      allowNull: true,
      defaultValue: 0
    });
    await queryInterface.addColumn('creditors', 'aging_31_to_60', {
      type: Sequelize.DECIMAL(12,2),
      allowNull: true,
      defaultValue: 0
    });
    await queryInterface.addColumn('creditors', 'aging_61_to_90', {
      type: Sequelize.DECIMAL(12,2),
      allowNull: true,
      defaultValue: 0
    });
    await queryInterface.addColumn('creditors', 'aging_over_90', {
      type: Sequelize.DECIMAL(12,2),
      allowNull: true,
      defaultValue: 0
    });

    // Nozzles table columns
    await queryInterface.addColumn('nozzles', 'last_reading', {
      type: Sequelize.DECIMAL(12,2),
      allowNull: true
    });
    await queryInterface.addColumn('nozzles', 'last_reading_date', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('creditors', 'last_transaction_date');
    await queryInterface.removeColumn('creditors', 'last_payment_date');
    await queryInterface.removeColumn('creditors', 'aging_0_to_30');
    await queryInterface.removeColumn('creditors', 'aging_31_to_60');
    await queryInterface.removeColumn('creditors', 'aging_61_to_90');
    await queryInterface.removeColumn('creditors', 'aging_over_90');
    await queryInterface.removeColumn('nozzles', 'last_reading');
    await queryInterface.removeColumn('nozzles', 'last_reading_date');
  }
};