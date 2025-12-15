"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add all missing columns to shifts table
    await Promise.all([
      queryInterface.addColumn("shifts", "manager_id", {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      }),
      queryInterface.addColumn("shifts", "readings_count", {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      }),
      queryInterface.addColumn("shifts", "total_litres_sold", {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0
      }),
      queryInterface.addColumn("shifts", "total_sales_amount", {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0
      }),
      queryInterface.addColumn("shifts", "status", {
        type: Sequelize.ENUM('active', 'ended', 'cancelled'),
        allowNull: true,
        defaultValue: 'active'
      }),
      queryInterface.addColumn("shifts", "ended_by", {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      }),
      queryInterface.addColumn("shifts", "notes", {
        type: Sequelize.TEXT,
        allowNull: true
      }),
      queryInterface.addColumn("shifts", "end_notes", {
        type: Sequelize.TEXT,
        allowNull: true
      })
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove all added columns
    await Promise.all([
      queryInterface.removeColumn("shifts", "manager_id"),
      queryInterface.removeColumn("shifts", "readings_count"),
      queryInterface.removeColumn("shifts", "total_litres_sold"),
      queryInterface.removeColumn("shifts", "total_sales_amount"),
      queryInterface.removeColumn("shifts", "status"),
      queryInterface.removeColumn("shifts", "ended_by"),
      queryInterface.removeColumn("shifts", "notes"),
      queryInterface.removeColumn("shifts", "end_notes")
    ]);
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_shifts_status";');
  }
};
