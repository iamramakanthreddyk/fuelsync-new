'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check current schema
      const nozzleReadingsDescription = await queryInterface.describeTable('nozzle_readings', { transaction });
      const settlementsDescription = await queryInterface.describeTable('settlements', { transaction });
      
      // Add status and carriedForwardFrom fields to nozzle_readings if they don't exist
      if (!nozzleReadingsDescription.status) {
        await queryInterface.addColumn('nozzle_readings', 'status', {
          type: Sequelize.ENUM('unsettled', 'pending_settlement', 'settled', 'carried_forward'),
          defaultValue: 'unsettled',
          allowNull: false,
          comment: 'Settlement workflow status for readings'
        }, { transaction });
      }

      if (!nozzleReadingsDescription.carried_forward_from) {
        await queryInterface.addColumn('nozzle_readings', 'carried_forward_from', {
          type: Sequelize.DATEONLY,
          allowNull: true,
          comment: 'Date when reading was carried forward from'
        }, { transaction });
      }

      // Add readingIds field to settlements if it doesn't exist
      if (!settlementsDescription.reading_ids) {
        await queryInterface.addColumn('settlements', 'reading_ids', {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Array of reading IDs included in this settlement'
        }, { transaction });
      }

      // For SQLite enum changes, we need to recreate the column
      // First, add a temporary column
      await queryInterface.addColumn('settlements', 'status_temp', {
        type: Sequelize.ENUM('draft', 'final', 'locked'),
        defaultValue: 'draft',
        allowNull: false
      }, { transaction });

      // Copy data to temp column
      await queryInterface.sequelize.query(`
        UPDATE settlements
        SET status_temp = 'draft'
      `, { transaction });

      // Remove old column
      await queryInterface.removeColumn('settlements', 'status', { transaction });

      // Rename temp column to status
      await queryInterface.renameColumn('settlements', 'status_temp', 'status', { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check current schema
      const nozzleReadingsDescription = await queryInterface.describeTable('nozzle_readings', { transaction });
      const settlementsDescription = await queryInterface.describeTable('settlements', { transaction });
      
      // Remove the new columns if they exist
      if (nozzleReadingsDescription.status) {
        await queryInterface.removeColumn('nozzle_readings', 'status', { transaction });
      }
      if (nozzleReadingsDescription.carried_forward_from) {
        await queryInterface.removeColumn('nozzle_readings', 'carried_forward_from', { transaction });
      }
      if (settlementsDescription.reading_ids) {
        await queryInterface.removeColumn('settlements', 'reading_ids', { transaction });
      }

      // Revert settlements status enum
      await queryInterface.changeColumn('settlements', 'status', {
        type: Sequelize.ENUM('recorded', 'approved', 'disputed'),
        defaultValue: 'recorded',
        allowNull: false
      }, { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};