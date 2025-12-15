"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("nozzle_readings", "pump_id", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "pumps",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("nozzle_readings", "pump_id");
  }
};
