'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Add deleted_at column for soft delete support
      await queryInterface.addColumn(
        'settlements',
        'deleted_at',
        {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Timestamp when record was soft-deleted'
        },
        { transaction }
      );

      // Add deleted_by column to track who deleted the record
      await queryInterface.addColumn(
        'settlements',
        'deleted_by',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          comment: 'User who deleted this settlement'
        },
        { transaction }
      );

      // Add deletion_reason column for audit trail
      await queryInterface.addColumn(
        'settlements',
        'deletion_reason',
        {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Reason for deletion (e.g., correction, duplicate)'
        },
        { transaction }
      );

      // Add index on deleted_at for efficient soft delete queries
      await queryInterface.addIndex(
        'settlements',
        ['deleted_at'],
        {
          name: 'idx_settlements_deleted_at',
          transaction
        }
      );

      await transaction.commit();
      console.log('✅ Soft delete columns added to settlements');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeIndex(
        'settlements',
        'idx_settlements_deleted_at',
        { transaction }
      );

      await queryInterface.removeColumn('settlements', 'deletion_reason', { transaction });
      await queryInterface.removeColumn('settlements', 'deleted_by', { transaction });
      await queryInterface.removeColumn('settlements', 'deleted_at', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
