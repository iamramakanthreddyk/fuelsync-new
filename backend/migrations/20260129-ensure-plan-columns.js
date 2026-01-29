"use strict";

/**
 * Migration: Ensure enhanced plan limit columns exist
 * Adds missing plan columns (sales_reports_days, profit_reports_days, analytics_data_days,
 * audit_logs_days, transaction_history_days) if they are absent. Uses a transaction and
 * checks columns via describeTable to be idempotent.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tableDescription = await queryInterface.describeTable('plans');

      if (!tableDescription.sales_reports_days) {
        await queryInterface.addColumn(
          'plans',
          'sales_reports_days',
          {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 30,
            comment: 'Days of historical sales data accessible'
          },
          { transaction }
        );
      }

      if (!tableDescription.profit_reports_days) {
        await queryInterface.addColumn(
          'plans',
          'profit_reports_days',
          {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 30,
            comment: 'Days of historical profit/loss data accessible'
          },
          { transaction }
        );
      }

      if (!tableDescription.analytics_data_days) {
        await queryInterface.addColumn(
          'plans',
          'analytics_data_days',
          {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 90,
            comment: 'Days of historical analytics data accessible'
          },
          { transaction }
        );
      }

      if (!tableDescription.audit_logs_days) {
        await queryInterface.addColumn(
          'plans',
          'audit_logs_days',
          {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 30,
            comment: 'Days of audit logs accessible'
          },
          { transaction }
        );
      }

      if (!tableDescription.transaction_history_days) {
        await queryInterface.addColumn(
          'plans',
          'transaction_history_days',
          {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 90,
            comment: 'Days of transaction history accessible'
          },
          { transaction }
        );
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tableDescription = await queryInterface.describeTable('plans');

      if (tableDescription.transaction_history_days) {
        await queryInterface.removeColumn('plans', 'transaction_history_days', { transaction });
      }
      if (tableDescription.audit_logs_days) {
        await queryInterface.removeColumn('plans', 'audit_logs_days', { transaction });
      }
      if (tableDescription.analytics_data_days) {
        await queryInterface.removeColumn('plans', 'analytics_data_days', { transaction });
      }
      if (tableDescription.profit_reports_days) {
        await queryInterface.removeColumn('plans', 'profit_reports_days', { transaction });
      }
      if (tableDescription.sales_reports_days) {
        await queryInterface.removeColumn('plans', 'sales_reports_days', { transaction });
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
