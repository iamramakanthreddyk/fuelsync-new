"use strict";

/**
 * Add pump_number column to pumps table
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pumps", "pump_number", {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "Pump number (display/order)"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("pumps", "pump_number");
  }
};
