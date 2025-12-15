'use strict';

/**
 * Migration to create daily_transactions table for daily payment breakdowns
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('daily_transactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true
      },
      station_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'stations', key: 'id' }
      },
      transaction_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      total_liters: {
        type: Sequelize.DECIMAL(10, 3),
        defaultValue: 0
      },
      total_sale_value: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0
      },
      payment_breakdown: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: { cash: 0, online: 0, credit: 0 }
      },
      credit_allocations: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      reading_ids: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('draft', 'submitted', 'settled', 'cancelled'),
        defaultValue: 'submitted'
      },
      settlement_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'settlements', key: 'id' }
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('daily_transactions');
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_daily_transactions_status\";");
  }
};
