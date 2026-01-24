'use strict';

/**
 * Migration: Add missing columns to tank_refills table
 * 
 * The TankRefill model expects these columns that may not exist:
 * - entry_type (ENUM)
 * - is_backdated (BOOLEAN)
 * - is_verified (BOOLEAN)
 * - verified_by (UUID)
 * - verified_at (TIMESTAMP)
 * - tank_level_before (DECIMAL)
 * - tank_level_after (DECIMAL)
 * - driver_phone (VARCHAR)
 * - refill_time (TIME)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Helper to check if column exists
      const columnExists = async (table, column) => {
        const [results] = await queryInterface.sequelize.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = '${table}' AND column_name = '${column}'
        `, { transaction });
        return results.length > 0;
      };

      // Add entry_type column
      if (!(await columnExists('tank_refills', 'entry_type'))) {
        await queryInterface.addColumn('tank_refills', 'entry_type', {
          type: Sequelize.STRING(20),
          defaultValue: 'refill',
          allowNull: false
        }, { transaction });
        console.log('✓ Added entry_type column');
      }

      // Add is_backdated column
      if (!(await columnExists('tank_refills', 'is_backdated'))) {
        await queryInterface.addColumn('tank_refills', 'is_backdated', {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }, { transaction });
        console.log('✓ Added is_backdated column');
      }

      // Add is_verified column
      if (!(await columnExists('tank_refills', 'is_verified'))) {
        await queryInterface.addColumn('tank_refills', 'is_verified', {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }, { transaction });
        console.log('✓ Added is_verified column');
      }

      // Add verified_by column
      if (!(await columnExists('tank_refills', 'verified_by'))) {
        await queryInterface.addColumn('tank_refills', 'verified_by', {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' }
        }, { transaction });
        console.log('✓ Added verified_by column');
      }

      // Add verified_at column
      if (!(await columnExists('tank_refills', 'verified_at'))) {
        await queryInterface.addColumn('tank_refills', 'verified_at', {
          type: Sequelize.DATE,
          allowNull: true
        }, { transaction });
        console.log('✓ Added verified_at column');
      }

      // Add tank_level_before column
      if (!(await columnExists('tank_refills', 'tank_level_before'))) {
        await queryInterface.addColumn('tank_refills', 'tank_level_before', {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true
        }, { transaction });
        console.log('✓ Added tank_level_before column');
      }

      // Add tank_level_after column
      if (!(await columnExists('tank_refills', 'tank_level_after'))) {
        await queryInterface.addColumn('tank_refills', 'tank_level_after', {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true
        }, { transaction });
        console.log('✓ Added tank_level_after column');
      }

      // Add driver_phone column
      if (!(await columnExists('tank_refills', 'driver_phone'))) {
        await queryInterface.addColumn('tank_refills', 'driver_phone', {
          type: Sequelize.STRING(20),
          allowNull: true
        }, { transaction });
        console.log('✓ Added driver_phone column');
      }

      // Add refill_time column
      if (!(await columnExists('tank_refills', 'refill_time'))) {
        await queryInterface.addColumn('tank_refills', 'refill_time', {
          type: Sequelize.TIME,
          allowNull: true
        }, { transaction });
        console.log('✓ Added refill_time column');
      }

      await transaction.commit();
      console.log('✅ Migration completed: tank_refills columns added');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      const columnsToRemove = [
        'entry_type',
        'is_backdated', 
        'is_verified',
        'verified_by',
        'verified_at',
        'tank_level_before',
        'tank_level_after',
        'driver_phone',
        'refill_time'
      ];

      for (const column of columnsToRemove) {
        try {
          await queryInterface.removeColumn('tank_refills', column, { transaction });
          console.log(`✓ Removed ${column} column`);
        } catch (err) {
          console.log(`⚠ Column ${column} may not exist, skipping`);
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
