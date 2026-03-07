'use strict';

/**
 * Migration: Enhance expenses table
 *
 * Supports Requirement 3: Daily/Monthly expense tracking with approval workflow.
 *
 * Adds:
 * - frequency       : 'daily' | 'monthly' | 'one_time' - helps categorize recurring vs one-off
 * - approved_by     : UUID of manager/owner who approved
 * - approval_status : 'pending' | 'approved' | 'rejected'
 * - approved_at     : Timestamp of approval
 * - tags            : JSONB array for custom tagging (["fuel", "overhead"])
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('expenses');

    if (!tableDescription.frequency) {
      await queryInterface.addColumn('expenses', 'frequency', {
        type: Sequelize.ENUM('daily', 'monthly', 'one_time', 'weekly'),
        allowNull: false,
        defaultValue: 'one_time',
        comment: 'How often this type of expense occurs (for reporting grouping)'
      });
    }

    if (!tableDescription.approved_by) {
      await queryInterface.addColumn('expenses', 'approved_by', {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: null,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Manager or owner who approved this expense'
      });
    }

    if (!tableDescription.approval_status) {
      await queryInterface.addColumn('expenses', 'approval_status', {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'auto_approved',
        comment: 'Approval state: pending (employee entry awaiting review), approved, rejected'
      });
    }

    if (!tableDescription.approved_at) {
      await queryInterface.addColumn('expenses', 'approved_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the expense was approved/rejected'
      });
    }

    if (!tableDescription.tags) {
      await queryInterface.addColumn('expenses', 'tags', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: 'Custom tags for the expense, e.g. ["overhead", "essential"]'
      });
    }

    // Index for approval workflow queries
    try {
      await queryInterface.addIndex('expenses', ['station_id', 'approval_status'], {
        name: 'idx_expenses_station_approval'
      });
    } catch (e) {
      console.warn('[MIGRATION] idx_expenses_station_approval already exists or failed, skipping');
    }

    // Index for frequency-based reporting
    try {
      await queryInterface.addIndex('expenses', ['station_id', 'frequency', 'expense_date'], {
        name: 'idx_expenses_station_frequency_date'
      });
    } catch (e) {
      console.warn('[MIGRATION] idx_expenses_station_frequency_date already exists, skipping');
    }
  },

  async down(queryInterface) {
    try { await queryInterface.removeIndex('expenses', 'idx_expenses_station_approval'); } catch (e) {}
    try { await queryInterface.removeIndex('expenses', 'idx_expenses_station_frequency_date'); } catch (e) {}
    await queryInterface.removeColumn('expenses', 'tags');
    await queryInterface.removeColumn('expenses', 'approved_at');
    await queryInterface.removeColumn('expenses', 'approval_status');
    await queryInterface.removeColumn('expenses', 'approved_by');
    await queryInterface.removeColumn('expenses', 'frequency');
  }
};
