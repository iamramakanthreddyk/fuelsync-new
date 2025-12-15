'use strict';

/**
 * Migration: Complete baseline schema creation
 *
 * Creates all core tables for FuelSync application:
 * - plans, users, stations, pumps, nozzles, fuel_prices
 * - nozzle_readings, creditors, credit_transactions
 * - expenses, cost_of_goods, tanks, tank_refills
 * - shifts, audit_logs, cash_handovers
 *
 * This replaces the need for separate schema.sql file
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ============================================
      // PLANS TABLE
      // ============================================
      await queryInterface.createTable('plans', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        name: {
          type: Sequelize.ENUM('Free', 'Basic', 'Premium'),
          allowNull: false,
          unique: true
        },
            // upload_limit removed
        features: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {}
        },
        price: {
          type: Sequelize.DECIMAL(8, 2),
          allowNull: false,
          defaultValue: 0
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // STATIONS TABLE
      // ============================================
      await queryInterface.createTable('stations', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        address: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        phone: {
          type: Sequelize.STRING(20),
          allowNull: true
        },
        email: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        owner_id: {
          type: Sequelize.UUID,
          allowNull: true
        },
        plan_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'plans',
            key: 'id'
          }
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // USERS TABLE
      // ============================================
      await queryInterface.createTable('users', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        email: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true
        },
        password: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        role: {
          type: Sequelize.ENUM('super_admin', 'owner', 'manager', 'employee'),
          allowNull: false,
          defaultValue: 'employee'
        },
        station_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'stations',
            key: 'id'
          }
        },
        plan_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'plans',
            key: 'id'
          }
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        last_login_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // PUMPS TABLE
      // ============================================
      await queryInterface.createTable('pumps', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('active', 'inactive', 'maintenance'),
          allowNull: false,
          defaultValue: 'active'
        },
        station_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'stations',
            key: 'id'
          }
        },
        last_maintenance_date: {
          type: Sequelize.DATE,
          allowNull: true
        },
        total_sales_today: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // NOZZLES TABLE
      // ============================================
      await queryInterface.createTable('nozzles', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        pump_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'pumps',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        number: {
          type: Sequelize.INTEGER,
          allowNull: false,
          validate: {
            min: 1,
            max: 10
          }
        },
        fuel_type: {
          type: Sequelize.ENUM('Petrol', 'Diesel'),
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('active', 'inactive'),
          allowNull: false,
          defaultValue: 'active'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Add unique constraint for pump_id + number
      await queryInterface.addIndex('nozzles', ['pump_id', 'number'], {
        unique: true,
        transaction
      });

      // ============================================
      // FUEL PRICES TABLE
      // ============================================
      await queryInterface.createTable('fuel_prices', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        station_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'stations',
            key: 'id'
          }
        },
        fuel_type: {
          type: Sequelize.ENUM('Petrol', 'Diesel'),
          allowNull: false
        },
        price: {
          type: Sequelize.DECIMAL(8, 2),
          allowNull: false,
          validate: {
            min: 0
          }
        },
        effective_from: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_by: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Add unique constraint for station_id + fuel_type + effective_from
      await queryInterface.addIndex('fuel_prices', ['station_id', 'fuel_type', 'effective_from'], {
        unique: true,
        transaction
      });

      // ============================================
      // NOZZLE READINGS TABLE
      // ============================================
      await queryInterface.createTable('nozzle_readings', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        nozzle_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'nozzles',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        station_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'stations',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        entered_by: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        reading_date: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        reading_value: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            min: 0
          }
        },
        previous_reading: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true
        },
        litres_sold: {
          type: Sequelize.DECIMAL(10, 3),
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: 0
          }
        },
        price_per_litre: {
          type: Sequelize.DECIMAL(8, 2),
          allowNull: true,
          validate: {
            min: 0
          }
        },
        total_amount: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: 0
          }
        },
        cash_amount: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: 0
          }
        },
        online_amount: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: 0
          }
        },
        is_initial_reading: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // CREDITORS TABLE
      // ============================================
      await queryInterface.createTable('creditors', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        station_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'stations',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        phone: {
          type: Sequelize.STRING(20),
          allowNull: true
        },
        email: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        address: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        credit_limit: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0
        },
        current_balance: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // CREDIT TRANSACTIONS TABLE
      // ============================================
      await queryInterface.createTable('credit_transactions', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        creditor_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'creditors',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        nozzle_reading_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'nozzle_readings',
            key: 'id'
          },
          onDelete: 'SET NULL'
        },
        station_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'stations',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        transaction_type: {
          type: Sequelize.ENUM('credit_sale', 'payment', 'adjustment'),
          allowNull: false
        },
        amount: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        transaction_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        created_by: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // EXPENSES TABLE
      // ============================================
      await queryInterface.createTable('expenses', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        station_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'stations',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        category: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: 0
          }
        },
        expense_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        created_by: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        approved_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        status: {
          type: Sequelize.ENUM('pending', 'approved', 'rejected'),
          allowNull: false,
          defaultValue: 'pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // COST OF GOODS TABLE
      // ============================================
      await queryInterface.createTable('cost_of_goods', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        station_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'stations',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        fuel_type: {
          type: Sequelize.ENUM('Petrol', 'Diesel'),
          allowNull: false
        },
        cost_per_litre: {
          type: Sequelize.DECIMAL(8, 2),
          allowNull: false,
          validate: {
            min: 0
          }
        },
        litres_purchased: {
          type: Sequelize.DECIMAL(10, 3),
          allowNull: false,
          validate: {
            min: 0
          }
        },
        total_cost: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            min: 0
          }
        },
        purchase_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        supplier: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        invoice_number: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        created_by: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // TANKS TABLE
      // ============================================
      await queryInterface.createTable('tanks', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        station_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'stations',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        name: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        fuel_type: {
          type: Sequelize.ENUM('Petrol', 'Diesel'),
          allowNull: false
        },
        capacity_litres: {
          type: Sequelize.DECIMAL(10, 3),
          allowNull: false,
          validate: {
            min: 0
          }
        },
        current_litres: {
          type: Sequelize.DECIMAL(10, 3),
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: 0
          }
        },
        status: {
          type: Sequelize.ENUM('active', 'inactive', 'maintenance'),
          allowNull: false,
          defaultValue: 'active'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // TANK REFILLS TABLE
      // ============================================
      await queryInterface.createTable('tank_refills', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        tank_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'tanks',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        station_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'stations',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        litres_added: {
          type: Sequelize.DECIMAL(10, 3),
          allowNull: false,
          validate: {
            min: 0
          }
        },
        cost_per_litre: {
          type: Sequelize.DECIMAL(8, 2),
          allowNull: false,
          validate: {
            min: 0
          }
        },
        total_cost: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            min: 0
          }
        },
        supplier: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        invoice_number: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        entered_by: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        verified_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        refill_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        status: {
          type: Sequelize.ENUM('pending', 'verified', 'rejected'),
          allowNull: false,
          defaultValue: 'pending'
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // SHIFTS TABLE
      // ============================================
      await queryInterface.createTable('shifts', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        station_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'stations',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        employee_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        shift_date: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        start_time: {
          type: Sequelize.TIME,
          allowNull: false
        },
        end_time: {
          type: Sequelize.TIME,
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('active', 'ended', 'cancelled'),
          allowNull: false,
          defaultValue: 'active'
        },
        ended_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // AUDIT LOGS TABLE
      // ============================================
      await queryInterface.createTable('audit_logs', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        station_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'stations',
            key: 'id'
          }
        },
        action: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        entity_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        entity_id: {
          type: Sequelize.UUID,
          allowNull: true
        },
        old_values: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        new_values: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        ip_address: {
          type: Sequelize.STRING(45),
          allowNull: true
        },
        user_agent: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // CASH HANDOVERS TABLE
      // ============================================
      await queryInterface.createTable('cash_handovers', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        station_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'stations',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        shift_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'shifts',
            key: 'id'
          }
        },
        from_user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        to_user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: 0
          }
        },
        handover_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        status: {
          type: Sequelize.ENUM('pending', 'confirmed', 'rejected'),
          allowNull: false,
          defaultValue: 'pending'
        },
        confirmed_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // ============================================
      // INDEXES FOR PERFORMANCE
      // ============================================

      // Users indexes
      await queryInterface.addIndex('users', ['email'], { transaction });
      await queryInterface.addIndex('users', ['role'], { transaction });
      await queryInterface.addIndex('users', ['station_id'], { transaction });

      // Nozzles indexes
      await queryInterface.addIndex('nozzles', ['pump_id'], { transaction });

      // Fuel prices indexes
      await queryInterface.addIndex('fuel_prices', ['station_id'], { transaction });
      await queryInterface.addIndex('fuel_prices', ['fuel_type'], { transaction });

      // Nozzle readings indexes
      await queryInterface.addIndex('nozzle_readings', ['nozzle_id'], { transaction });
      await queryInterface.addIndex('nozzle_readings', ['station_id'], { transaction });
      await queryInterface.addIndex('nozzle_readings', ['reading_date'], { transaction });
      await queryInterface.addIndex('nozzle_readings', ['nozzle_id', 'reading_date'], { transaction });
      await queryInterface.addIndex('nozzle_readings', ['station_id', 'reading_date'], { transaction });

      // Creditors indexes
      await queryInterface.addIndex('creditors', ['station_id'], { transaction });

      // Credit transactions indexes
      await queryInterface.addIndex('credit_transactions', ['creditor_id'], { transaction });
      await queryInterface.addIndex('credit_transactions', ['station_id'], { transaction });
      await queryInterface.addIndex('credit_transactions', ['transaction_date'], { transaction });

      // Expenses indexes
      await queryInterface.addIndex('expenses', ['station_id'], { transaction });
      await queryInterface.addIndex('expenses', ['expense_date'], { transaction });
      await queryInterface.addIndex('expenses', ['status'], { transaction });

      // Cost of goods indexes
      await queryInterface.addIndex('cost_of_goods', ['station_id'], { transaction });
      await queryInterface.addIndex('cost_of_goods', ['fuel_type'], { transaction });
      await queryInterface.addIndex('cost_of_goods', ['purchase_date'], { transaction });

      // Tank refills indexes
      await queryInterface.addIndex('tank_refills', ['tank_id'], { transaction });
      await queryInterface.addIndex('tank_refills', ['station_id'], { transaction });
      await queryInterface.addIndex('tank_refills', ['refill_date'], { transaction });
      await queryInterface.addIndex('tank_refills', ['status'], { transaction });

      // Shifts indexes
      await queryInterface.addIndex('shifts', ['station_id'], { transaction });
      await queryInterface.addIndex('shifts', ['employee_id'], { transaction });
      await queryInterface.addIndex('shifts', ['shift_date'], { transaction });
      await queryInterface.addIndex('shifts', ['status'], { transaction });

      // Audit logs indexes
      await queryInterface.addIndex('audit_logs', ['user_id'], { transaction });
      await queryInterface.addIndex('audit_logs', ['station_id'], { transaction });
      await queryInterface.addIndex('audit_logs', ['created_at'], { transaction });

      // Cash handovers indexes
      await queryInterface.addIndex('cash_handovers', ['station_id'], { transaction });
      await queryInterface.addIndex('cash_handovers', ['shift_id'], { transaction });
      await queryInterface.addIndex('cash_handovers', ['handover_date'], { transaction });
      await queryInterface.addIndex('cash_handovers', ['status'], { transaction });

      await transaction.commit();
      console.log('✅ Migration completed: Complete baseline schema created');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Drop tables in reverse order (due to foreign key constraints)

      // Drop cash_handovers
      await queryInterface.dropTable('cash_handovers', { transaction });

      // Drop audit_logs
      await queryInterface.dropTable('audit_logs', { transaction });

      // Drop shifts
      await queryInterface.dropTable('shifts', { transaction });

      // Drop tank_refills
      await queryInterface.dropTable('tank_refills', { transaction });

      // Drop tanks
      await queryInterface.dropTable('tanks', { transaction });

      // Drop cost_of_goods
      await queryInterface.dropTable('cost_of_goods', { transaction });

      // Drop expenses
      await queryInterface.dropTable('expenses', { transaction });

      // Drop credit_transactions
      await queryInterface.dropTable('credit_transactions', { transaction });

      // Drop creditors
      await queryInterface.dropTable('creditors', { transaction });

      // Drop nozzle_readings
      await queryInterface.dropTable('nozzle_readings', { transaction });

      // Drop fuel_prices
      await queryInterface.dropTable('fuel_prices', { transaction });

      // Drop nozzles
      await queryInterface.dropTable('nozzles', { transaction });

      // Drop pumps
      await queryInterface.dropTable('pumps', { transaction });

      // Drop users
      await queryInterface.dropTable('users', { transaction });

      // Drop stations
      await queryInterface.dropTable('stations', { transaction });

      // Drop plans
      await queryInterface.dropTable('plans', { transaction });

      await transaction.commit();
      console.log('⬇️ Migration rolled back: Complete baseline schema removed');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
