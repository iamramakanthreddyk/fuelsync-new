'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add cost_price column to fuel_prices table
    await queryInterface.addColumn('fuel_prices', 'cost_price', {
      type: Sequelize.DECIMAL(8, 2),
      allowNull: true,
      defaultValue: null,
      field: 'cost_price',
      comment: 'Purchase/cost price per litre for profit calculation'
    });

    // Add index for performance
    await queryInterface.addIndex('fuel_prices', ['cost_price'], {
      name: 'idx_fuel_prices_cost_price'
    });

    console.log('✅ Added cost_price column to fuel_prices');
  },

  async down (queryInterface, Sequelize) {
    // Remove index
    await queryInterface.removeIndex('fuel_prices', 'idx_fuel_prices_cost_price');
    
    // Remove column
    await queryInterface.removeColumn('fuel_prices', 'cost_price');
    
    console.log('✅ Rolled back cost_price column from fuel_prices');
  }
};
