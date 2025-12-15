"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("shifts", "cash_difference", {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("shifts", "cash_difference");
  }
};
