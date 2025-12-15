"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("shifts", "opening_cash", {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("shifts", "opening_cash");
  }
};
