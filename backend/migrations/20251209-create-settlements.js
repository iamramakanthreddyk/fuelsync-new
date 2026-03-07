"use strict";

/**
 * Sequelize migration: create settlements table with a Postgres-safe enum for status
 * - up: creates enum type (if using postgres) and settlements table
 * - down: drops table and enum type
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    // Create settlements table (use UUIDs to match models)
    const idType = Sequelize.DataTypes.UUID;
    const uuidDefault = dialect === 'postgres' ? Sequelize.literal('gen_random_uuid()') : undefined;

    const columns = {
      id: {
        type: idType,
        primaryKey: true,
        allowNull: false,
        defaultValue: uuidDefault
      },
      station_id: {
        type: Sequelize.DataTypes.UUID,
        allowNull: false,
        references: { model: 'stations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      date: {
        type: Sequelize.DataTypes.DATEONLY,
        allowNull: false
      },
      expected_cash: {
        type: Sequelize.DataTypes.DECIMAL(12,2),
        allowNull: false,
        defaultValue: 0
      },
      actual_cash: {
        type: Sequelize.DataTypes.DECIMAL(12,2),
        allowNull: false,
        defaultValue: 0
      },
      variance: {
        type: Sequelize.DataTypes.DECIMAL(12,2),
        allowNull: true
      },
      // Employee-reported values (auto-aggregated from readings)
      employee_cash: {
        type: Sequelize.DataTypes.DECIMAL(12,2),
        allowNull: false,
        defaultValue: 0
      },
      employee_online: {
        type: Sequelize.DataTypes.DECIMAL(12,2),
        allowNull: false,
        defaultValue: 0
      },
      employee_credit: {
        type: Sequelize.DataTypes.DECIMAL(12,2),
        allowNull: false,
        defaultValue: 0
      },
      // Owner-confirmed values
      online: {
        type: Sequelize.DataTypes.DECIMAL(12,2),
        allowNull: false,
        defaultValue: 0
      },
      credit: {
        type: Sequelize.DataTypes.DECIMAL(12,2),
        allowNull: false,
        defaultValue: 0
      },
      // Variance for online and credit
      variance_online: {
        type: Sequelize.DataTypes.DECIMAL(12,2),
        allowNull: true,
        defaultValue: 0
      },
      variance_credit: {
        type: Sequelize.DataTypes.DECIMAL(12,2),
        allowNull: true,
        defaultValue: 0
      },
      is_final: {
        type: Sequelize.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      finalized_at: {
        type: Sequelize.DataTypes.DATE,
        allowNull: true
      },
      notes: {
        type: Sequelize.DataTypes.TEXT,
        allowNull: true
      },
      recorded_by: {
        type: Sequelize.DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      recorded_at: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      status: {
        // Use VARCHAR to avoid PostgreSQL ENUM type issues
        type: Sequelize.DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'draft',
        validate: {
          isIn: [['draft', 'final', 'locked']]
        }
      }
    };

    // Attach timestamps
    columns.created_at = {
      type: Sequelize.DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    };
    columns.updated_at = {
      type: Sequelize.DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    };

    await queryInterface.createTable('settlements', columns);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('settlements');
  }
};
