'use strict';

/**
 * Migration to add payment_breakdown column to nozzle_readings table
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('nozzle_readings', 'payment_breakdown', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Flexible payment split: { cash: 1000, upi: 500, card: 200, credit: 300 }'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('nozzle_readings', 'payment_breakdown');
  }
};
