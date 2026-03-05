'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Add deleted_at column
      await queryInterface.addColumn(
        'expenses',
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
        'expenses',
        'deleted_by',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          comment: 'User who deleted this expense'
        },
        { transaction }
      );

      // Add deletion_reason column
      await queryInterface.addColumn(
        'expenses',
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
        'expenses',
        ['deleted_at'],
        {
          name: 'idx_expenses_deleted_at',
          transaction
        }
      );

      await transaction.commit();
      console.log('✅ Soft delete columns added to expenses');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeIndex(
        'expenses',
        'idx_expenses_deleted_at',
        { transaction }
      );

      await queryInterface.removeColumn('expenses', 'deletion_reason', { transaction });
      await queryInterface.removeColumn('expenses', 'deleted_by', { transaction });
      await queryInterface.removeColumn('expenses', 'deleted_at', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
