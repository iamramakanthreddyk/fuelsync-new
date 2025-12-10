"use strict";

/**
 * Migration: Add settlement_id to nozzle_readings table
 * 
 * This allows linking specific employee readings to a settlement record,
 * enabling owner to select which readings are included in a settlement.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if column already exists
      const tableDescription = await queryInterface.describeTable('nozzle_readings', { transaction });
      
      if (!tableDescription.settlement_id) {
        // Add settlement_id column to nozzle_readings
        await queryInterface.addColumn('nozzle_readings', 'settlement_id', {
          type: Sequelize.DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'settlements',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        }, { transaction });

        // Add index for faster lookups
        await queryInterface.addIndex('nozzle_readings', ['settlement_id'], {
          name: 'idx_nozzle_readings_settlement_id',
          transaction
        });
      }
      
      await transaction.commit();
      console.log('✅ Migration completed: Added settlement_id to nozzle_readings');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      const tableDescription = await queryInterface.describeTable('nozzle_readings', { transaction });
      
      if (tableDescription.settlement_id) {
        try {
          await queryInterface.removeIndex('nozzle_readings', 'idx_nozzle_readings_settlement_id', { transaction });
        } catch (e) {
          // Index may not exist
        }
        await queryInterface.removeColumn('nozzle_readings', 'settlement_id', { transaction });
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
