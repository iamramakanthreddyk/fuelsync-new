'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Helper function to safely add columns (no transaction to avoid rollback issues)
    const addColumnIfNotExists = async (table, columnName, columnDefinition) => {
      try {
        await queryInterface.addColumn(table, columnName, columnDefinition);
        console.log(`✓ Added ${table}.${columnName}`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`⊘ ${table}.${columnName} already exists`);
        } else {
          throw err;
        }
      }
    };

    // Add missing columns to plans table
    await addColumnIfNotExists('plans', 'description', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await addColumnIfNotExists('plans', 'max_stations', {
      type: Sequelize.INTEGER,
      defaultValue: 1
    });

    await addColumnIfNotExists('plans', 'max_pumps_per_station', {
      type: Sequelize.INTEGER,
      defaultValue: 2
    });

    await addColumnIfNotExists('plans', 'max_nozzles_per_pump', {
      type: Sequelize.INTEGER,
      defaultValue: 4
    });

    await addColumnIfNotExists('plans', 'max_employees', {
      type: Sequelize.INTEGER,
      defaultValue: 2
    });

    await addColumnIfNotExists('plans', 'max_creditors', {
      type: Sequelize.INTEGER,
      defaultValue: 10
    });

    await addColumnIfNotExists('plans', 'backdated_days', {
      type: Sequelize.INTEGER,
      defaultValue: 3
    });

    await addColumnIfNotExists('plans', 'analytics_days', {
      type: Sequelize.INTEGER,
      defaultValue: 7
    });

    await addColumnIfNotExists('plans', 'can_export', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await addColumnIfNotExists('plans', 'can_track_expenses', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await addColumnIfNotExists('plans', 'can_track_credits', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    });

    await addColumnIfNotExists('plans', 'can_view_profit_loss', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await addColumnIfNotExists('plans', 'price_monthly', {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0
    });

    await addColumnIfNotExists('plans', 'price_yearly', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    });

    await addColumnIfNotExists('plans', 'sort_order', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    });

    await addColumnIfNotExists('plans', 'is_active', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    });

    // Add missing columns to users table
    await addColumnIfNotExists('users', 'created_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    });

    // Add missing columns to stations table
    await addColumnIfNotExists('stations', 'owner_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    });

    await addColumnIfNotExists('stations', 'code', {
      type: Sequelize.STRING(20),
      allowNull: true
    });

    await addColumnIfNotExists('stations', 'require_shift_for_readings', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await addColumnIfNotExists('stations', 'alert_on_missed_readings', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    });

    await addColumnIfNotExists('stations', 'missed_reading_threshold_days', {
      type: Sequelize.INTEGER,
      defaultValue: 1
    });
  },

  async down(queryInterface, Sequelize) {
    // Helper function to safely remove columns
    const removeColumnIfExists = async (table, columnName) => {
      try {
        await queryInterface.removeColumn(table, columnName);
        console.log(`✓ Removed ${table}.${columnName}`);
      } catch (err) {
        if (err.message.includes('does not exist')) {
          console.log(`⊘ ${table}.${columnName} does not exist`);
        } else {
          throw err;
        }
      }
    };

    // Remove columns from plans table
    await removeColumnIfExists('plans', 'description');
    await removeColumnIfExists('plans', 'max_creditors');
    await removeColumnIfExists('plans', 'can_track_expenses');
    await removeColumnIfExists('plans', 'price_yearly');
    await removeColumnIfExists('plans', 'sort_order');

    // Remove columns from users table
    await removeColumnIfExists('users', 'created_by');

    // Remove columns from stations table
    await removeColumnIfExists('stations', 'owner_id');
    await removeColumnIfExists('stations', 'code');
    await removeColumnIfExists('stations', 'require_shift_for_readings');
    await removeColumnIfExists('stations', 'alert_on_missed_readings');
    await removeColumnIfExists('stations', 'missed_reading_threshold_days');
  }
};
