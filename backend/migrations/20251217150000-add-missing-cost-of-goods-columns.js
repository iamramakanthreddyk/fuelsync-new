'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add missing columns to cost_of_goods table to match the model

    // Add month column
    await queryInterface.addColumn('cost_of_goods', 'month', {
      type: Sequelize.STRING(7), // YYYY-MM format
      allowNull: true // Allow null initially
    });

    // Add avg_cost_per_litre column
    await queryInterface.addColumn('cost_of_goods', 'avg_cost_per_litre', {
      type: Sequelize.DECIMAL(8, 2),
      allowNull: true
    });

    // Add supplier_name column
    await queryInterface.addColumn('cost_of_goods', 'supplier_name', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    // Add invoice_numbers column
    await queryInterface.addColumn('cost_of_goods', 'invoice_numbers', {
      type: Sequelize.JSONB,
      defaultValue: [],
      allowNull: true
    });

    // Rename created_by to entered_by to match model
    await queryInterface.renameColumn('cost_of_goods', 'created_by', 'entered_by');

    // Populate month column from purchase_date for existing records
    await queryInterface.sequelize.query(`
      UPDATE cost_of_goods
      SET month = TO_CHAR(purchase_date, 'YYYY-MM')
      WHERE month IS NULL
    `);

    // Calculate avg_cost_per_litre for existing records
    await queryInterface.sequelize.query(`
      UPDATE cost_of_goods
      SET avg_cost_per_litre = ROUND(total_cost / litres_purchased, 2)
      WHERE avg_cost_per_litre IS NULL AND litres_purchased > 0
    `);

    // Make month column NOT NULL
    await queryInterface.changeColumn('cost_of_goods', 'month', {
      type: Sequelize.STRING(7),
      allowNull: false
    });

    // Add indexes
    await queryInterface.addIndex('cost_of_goods', ['month'], {
      name: 'cost_of_goods_month'
    });

    await queryInterface.addIndex('cost_of_goods', ['station_id', 'month', 'fuel_type'], {
      name: 'cost_of_goods_unique_station_month_fuel',
      unique: true
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('cost_of_goods', 'cost_of_goods_month');
    await queryInterface.removeIndex('cost_of_goods', 'cost_of_goods_unique_station_month_fuel');

    // Rename entered_by back to created_by
    await queryInterface.renameColumn('cost_of_goods', 'entered_by', 'created_by');

    // Remove added columns
    await queryInterface.removeColumn('cost_of_goods', 'invoice_numbers');
    await queryInterface.removeColumn('cost_of_goods', 'supplier_name');
    await queryInterface.removeColumn('cost_of_goods', 'avg_cost_per_litre');
    await queryInterface.removeColumn('cost_of_goods', 'month');
  }
};