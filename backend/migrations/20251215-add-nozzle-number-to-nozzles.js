"use strict";

/**
 * Add nozzle_number to nozzles table
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("nozzles", "nozzle_number", {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "Nozzle number (display/order)"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("nozzles", "nozzle_number");
  }
};
