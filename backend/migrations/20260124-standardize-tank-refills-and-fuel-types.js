'use strict';

/**
 * Migration: Standardize tank_refills schema and fuel types across all tables
 * 
 * Issues Fixed:
 * 1. tank_refills.litres_added -> litres (model expects 'litres')
 * 2. tank_refills.supplier -> supplier_name (model expects 'supplierName')
 * 3. Add missing columns from model (refill_time, vehicle_number, notes, type, level_before, level_after)
 * 4. Convert all fuel_type ENUM columns to VARCHAR for flexibility
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      const dialect = queryInterface.sequelize.getDialect();
      
      console.log('=== Standardizing tank_refills schema ===');
      
      // Check current columns in tank_refills
      const [columns] = await queryInterface.sequelize.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'tank_refills'
      `, { transaction });
      
      const columnNames = columns.map(c => c.column_name);
      console.log('Current columns:', columnNames.join(', '));
      
      // 1. Rename litres_added to litres if needed
      if (columnNames.includes('litres_added') && !columnNames.includes('litres')) {
        console.log('Renaming litres_added -> litres');
        await queryInterface.renameColumn('tank_refills', 'litres_added', 'litres', { transaction });
      }
      
      // 2. Rename supplier to supplier_name if needed
      if (columnNames.includes('supplier') && !columnNames.includes('supplier_name')) {
        console.log('Renaming supplier -> supplier_name');
        await queryInterface.renameColumn('tank_refills', 'supplier', 'supplier_name', { transaction });
      }
      
      // 3. Add missing columns
      if (!columnNames.includes('refill_time')) {
        console.log('Adding refill_time column');
        await queryInterface.addColumn('tank_refills', 'refill_time', {
          type: Sequelize.TIME,
          allowNull: true
        }, { transaction });
      }
      
      if (!columnNames.includes('vehicle_number')) {
        console.log('Adding vehicle_number column');
        await queryInterface.addColumn('tank_refills', 'vehicle_number', {
          type: Sequelize.STRING(20),
          allowNull: true
        }, { transaction });
      }
      
      if (!columnNames.includes('notes')) {
        console.log('Adding notes column');
        await queryInterface.addColumn('tank_refills', 'notes', {
          type: Sequelize.TEXT,
          allowNull: true
        }, { transaction });
      }
      
      if (!columnNames.includes('type')) {
        console.log('Adding type column');
        await queryInterface.addColumn('tank_refills', 'type', {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: 'delivery'
        }, { transaction });
      }
      
      if (!columnNames.includes('level_before')) {
        console.log('Adding level_before column');
        await queryInterface.addColumn('tank_refills', 'level_before', {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true
        }, { transaction });
      }
      
      if (!columnNames.includes('level_after')) {
        console.log('Adding level_after column');
        await queryInterface.addColumn('tank_refills', 'level_after', {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true
        }, { transaction });
      }
      
      // 4. Make cost_per_litre nullable (not always known)
      await queryInterface.changeColumn('tank_refills', 'cost_per_litre', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      }, { transaction });
      
      // 5. Make total_cost nullable
      await queryInterface.changeColumn('tank_refills', 'total_cost', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      }, { transaction });
      
      // 6. Make entered_by nullable (for API-created entries)
      if (columnNames.includes('entered_by')) {
        await queryInterface.changeColumn('tank_refills', 'entered_by', {
          type: Sequelize.UUID,
          allowNull: true
        }, { transaction });
      }
      
      console.log('=== Converting fuel_type ENUMs to VARCHAR ===');
      
      // Tables that might have fuel_type ENUM columns
      const tablesToFix = ['nozzles', 'fuel_prices', 'cost_of_goods'];
      
      for (const tableName of tablesToFix) {
        try {
          const [tableColumns] = await queryInterface.sequelize.query(`
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = '${tableName}' AND column_name = 'fuel_type'
          `, { transaction });
          
          if (tableColumns.length > 0 && tableColumns[0].data_type === 'USER-DEFINED') {
            console.log(`Converting ${tableName}.fuel_type from ENUM to VARCHAR...`);
            
            // Create temp column
            await queryInterface.addColumn(tableName, 'fuel_type_new', {
              type: Sequelize.STRING(30),
              allowNull: true
            }, { transaction });
            
            // Copy data with lowercase
            await queryInterface.sequelize.query(`
              UPDATE "${tableName}" SET fuel_type_new = LOWER(fuel_type::text)
            `, { transaction });
            
            // Drop old column
            await queryInterface.removeColumn(tableName, 'fuel_type', { transaction });
            
            // Rename new column
            await queryInterface.renameColumn(tableName, 'fuel_type_new', 'fuel_type', { transaction });
            
            // Set NOT NULL
            await queryInterface.changeColumn(tableName, 'fuel_type', {
              type: Sequelize.STRING(30),
              allowNull: false
            }, { transaction });
            
            console.log(`✅ ${tableName}.fuel_type converted to VARCHAR`);
          }
        } catch (err) {
          console.log(`Skipping ${tableName}: ${err.message}`);
        }
      }
      
      // Drop old enum types
      const enumTypes = [
        'enum_nozzles_fuel_type',
        'enum_fuel_prices_fuel_type', 
        'enum_cost_of_goods_fuel_type'
      ];
      
      for (const enumType of enumTypes) {
        try {
          await queryInterface.sequelize.query(`
            DROP TYPE IF EXISTS "${enumType}" CASCADE
          `, { transaction });
          console.log(`Dropped ${enumType}`);
        } catch (err) {
          // Ignore if doesn't exist
        }
      }
      
      await transaction.commit();
      console.log('✅ Migration completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('⚠️ Down migration not implemented - changes are improvements');
  }
};
