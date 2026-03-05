'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Add deleted_at column
      await queryInterface.addColumn(
        'daily_transactions',
        'deleted_at',
        {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Timestamp when record was soft-deleted'
        },
        { transaction }
      );

      // Add deleted_by column
      await queryInterface.addColumn(
        'daily_transactions',
        'deleted_by',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          comment: 'User who deleted this transaction'
        },
        { transaction }
      );

      // Add deletion_reason column
      await queryInterface.addColumn(
        'daily_transactions',
        'deletion_reason',
        {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Reason for deletion (e.g., correction, duplicate)'
        },
        { transaction }
      );

      // Add index on deleted_at
      await queryInterface.addIndex(
        'daily_transactions',
        ['deleted_at'],
        {
          name: 'idx_daily_transactions_deleted_at',
          transaction
        }
      );

      await transaction.commit();
      console.log('✅ Soft delete columns added to daily_transactions');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeIndex(
        'daily_transactions',
        'idx_daily_transactions_deleted_at',
        { transaction }
      );

      await queryInterface.removeColumn('daily_transactions', 'deletion_reason', { transaction });
      await queryInterface.removeColumn('daily_transactions', 'deleted_by', { transaction });
      await queryInterface.removeColumn('daily_transactions', 'deleted_at', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
