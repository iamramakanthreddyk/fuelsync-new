'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if columns already exist
    const tableDescription = await queryInterface.describeTable('plans');
    
    // Add new usage quota fields to plans table if they don't exist
    if (!tableDescription.max_exports_monthly) {
      await queryInterface.addColumn('plans', 'max_exports_monthly', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
        comment: 'Maximum CSV exports allowed per month'
      });
    }

    if (!tableDescription.max_reports_monthly) {
      await queryInterface.addColumn('plans', 'max_reports_monthly', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 10,
        comment: 'Maximum advanced reports allowed per month'
      });
    }

    if (!tableDescription.max_manual_entries_monthly) {
      await queryInterface.addColumn('plans', 'max_manual_entries_monthly', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 20,
        comment: 'Maximum manual entries allowed per month'
      });
    }

    if (!tableDescription.export_max_rows) {
      await queryInterface.addColumn('plans', 'export_max_rows', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 50,
        comment: 'Maximum rows allowed in CSV exports'
      });
    }

    if (!tableDescription.report_data_days) {
      await queryInterface.addColumn('plans', 'report_data_days', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
        comment: 'Number of days of historical data available in reports'
      });
    }

    // Add new time range limit fields
    if (!tableDescription.sales_reports_days) {
      await queryInterface.addColumn('plans', 'sales_reports_days', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
        comment: 'Days of historical sales data accessible'
      });
    }

    if (!tableDescription.profit_reports_days) {
      await queryInterface.addColumn('plans', 'profit_reports_days', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
        comment: 'Days of historical profit/loss data accessible'
      });
    }

    if (!tableDescription.analytics_data_days) {
      await queryInterface.addColumn('plans', 'analytics_data_days', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 90,
        comment: 'Days of historical analytics data accessible'
      });
    }

    if (!tableDescription.audit_logs_days) {
      await queryInterface.addColumn('plans', 'audit_logs_days', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
        comment: 'Days of audit logs accessible'
      });
    }

    if (!tableDescription.transaction_history_days) {
      await queryInterface.addColumn('plans', 'transaction_history_days', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 90,
        comment: 'Days of transaction history accessible'
      });
    }
    // Note: Plan names will be updated manually by super admin through the UI
    // Default values are set in the column definitions above
  },

  async down(queryInterface, Sequelize) {
    // Check if columns exist before removing
    const tableDescription = await queryInterface.describeTable('plans');
    
    // Remove the added columns if they exist
    if (tableDescription.max_exports_monthly) {
      await queryInterface.removeColumn('plans', 'max_exports_monthly');
    }
    if (tableDescription.max_reports_monthly) {
      await queryInterface.removeColumn('plans', 'max_reports_monthly');
    }
    if (tableDescription.max_manual_entries_monthly) {
      await queryInterface.removeColumn('plans', 'max_manual_entries_monthly');
    }
    if (tableDescription.export_max_rows) {
      await queryInterface.removeColumn('plans', 'export_max_rows');
    }
    if (tableDescription.report_data_days) {
      await queryInterface.removeColumn('plans', 'report_data_days');
    }
    if (tableDescription.sales_reports_days) {
      await queryInterface.removeColumn('plans', 'sales_reports_days');
    }
    if (tableDescription.profit_reports_days) {
      await queryInterface.removeColumn('plans', 'profit_reports_days');
    }
    if (tableDescription.analytics_data_days) {
      await queryInterface.removeColumn('plans', 'analytics_data_days');
    }
    if (tableDescription.audit_logs_days) {
      await queryInterface.removeColumn('plans', 'audit_logs_days');
    }
    if (tableDescription.transaction_history_days) {
      await queryInterface.removeColumn('plans', 'transaction_history_days');
    }
  }
};