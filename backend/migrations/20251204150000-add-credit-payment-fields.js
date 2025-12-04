'use strict';

/**
 * Migration: Add payment tracking fields to nozzle_readings
 * 
 * Adds support for credit payments and creditor tracking:
 * - creditAmount: Amount paid via credit
 * - creditorId: Reference to creditor (for credit sales)
 * 
 * This enables complete payment method tracking:
 * - Cash (cashAmount)
 * - Online (onlineAmount)
 * - Credit (creditAmount + creditorId)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if columns already exist
      const tableDescription = await queryInterface.describeTable('nozzle_readings', { transaction });
      
      // Add creditAmount column if it doesn't exist
      if (!tableDescription.credit_amount) {
        await queryInterface.addColumn('nozzle_readings', 'credit_amount', {
          type: Sequelize.DECIMAL(12, 2),
          defaultValue: 0,
          allowNull: false,
          comment: 'Amount paid via credit'
        }, { transaction });
      }
      
      // Add creditorId column if it doesn't exist
      if (!tableDescription.creditor_id) {
        await queryInterface.addColumn('nozzle_readings', 'creditor_id', {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'creditors',
            key: 'id'
          },
          comment: 'Reference to creditor for credit sales'
        }, { transaction });
      }
      
      // Add index for creditor lookups
      const indexes = await queryInterface.showIndex('nozzle_readings', { transaction });
      const hasCreditorIndex = indexes.some(idx => idx.name === 'idx_readings_creditor');
      
      if (!hasCreditorIndex) {
        await queryInterface.addIndex('nozzle_readings', ['creditor_id'], {
          name: 'idx_readings_creditor',
          transaction
        });
      }

      await transaction.commit();
      console.log('✅ Migration completed: Added payment tracking fields (creditAmount, creditorId)');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove index
      try {
        await queryInterface.removeIndex('nozzle_readings', 'idx_readings_creditor', { transaction });
      } catch (e) {
        // Index may not exist, ignore
      }
      
      // Remove columns
      const tableDescription = await queryInterface.describeTable('nozzle_readings', { transaction });
      
      if (tableDescription.creditor_id) {
        await queryInterface.removeColumn('nozzle_readings', 'creditor_id', { transaction });
      }
      
      if (tableDescription.credit_amount) {
        await queryInterface.removeColumn('nozzle_readings', 'credit_amount', { transaction });
      }
      
      await transaction.commit();
      console.log('⬇️ Migration rolled back: Removed payment tracking fields');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
