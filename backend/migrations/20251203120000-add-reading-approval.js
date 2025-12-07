'use strict';

/**
 * Migration: Add approval workflow fields to nozzle_readings
 * 
 * This enables manager/owner approval of readings before they're locked.
 * Also adds fields for better cash reconciliation tracking.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add shift_id column for shift tracking
      await queryInterface.addColumn('nozzle_readings', 'shift_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'shifts',
          key: 'id'
        }
      }, { transaction });

      // Add approval status to nozzle_readings
      await queryInterface.addColumn('nozzle_readings', 'approval_status', {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
        allowNull: false
      }, { transaction });

      await queryInterface.addColumn('nozzle_readings', 'approved_by', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      }, { transaction });

      await queryInterface.addColumn('nozzle_readings', 'approved_at', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('nozzle_readings', 'rejection_reason', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction });

      // Add index for efficient queries
      await queryInterface.addIndex('nozzle_readings', ['station_id', 'approval_status'], {
        name: 'idx_readings_station_approval',
        transaction
      });

      await queryInterface.addIndex('nozzle_readings', ['shift_id', 'approval_status'], {
        name: 'idx_readings_shift_approval',
        transaction
      });

      await transaction.commit();
      console.log('✅ Migration completed: Added approval workflow to nozzle_readings');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      await queryInterface.removeIndex('nozzle_readings', 'idx_readings_shift_approval', { transaction });
      await queryInterface.removeIndex('nozzle_readings', 'idx_readings_station_approval', { transaction });
      
      await queryInterface.removeColumn('nozzle_readings', 'rejection_reason', { transaction });
      await queryInterface.removeColumn('nozzle_readings', 'approved_at', { transaction });
      await queryInterface.removeColumn('nozzle_readings', 'approved_by', { transaction });
      await queryInterface.removeColumn('nozzle_readings', 'approval_status', { transaction });
      await queryInterface.removeColumn('nozzle_readings', 'shift_id', { transaction });
      
      // Drop the ENUM type
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_nozzle_readings_approval_status";',
        { transaction }
      );
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
