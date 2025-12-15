'use strict';

/**
 * Migration: Patch all missing columns and enum values for full schema sync
 * Ensures DB matches Sequelize models and SQL schema
 * Includes all fixes from helper scripts (add-missing-columns.js, fix-enum.js)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add missing columns to plans
    await queryInterface.addColumn('plans', 'description', {
      type: Sequelize.STRING(255),
      allowNull: true
    }).catch(() => {});
    await queryInterface.addColumn('plans', 'max_creditors', {
      type: Sequelize.INTEGER,
      defaultValue: 10
    }).catch(() => {});
    await queryInterface.addColumn('plans', 'can_track_expenses', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    }).catch(() => {});
    await queryInterface.addColumn('plans', 'price_yearly', {
      type: Sequelize.DECIMAL(10,2),
      allowNull: true
    }).catch(() => {});
    await queryInterface.addColumn('plans', 'sort_order', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    }).catch(() => {});

    // Add missing columns to users
    await queryInterface.addColumn('users', 'created_by', {
      type: Sequelize.UUID,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      allowNull: true
    }).catch(() => {});

    // Add missing columns to stations
    await queryInterface.addColumn('stations', 'owner_id', {
      type: Sequelize.UUID,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
      allowNull: true
    }).catch(() => {});
    await queryInterface.addColumn('stations', 'code', {
      type: Sequelize.STRING(20),
      allowNull: true
    }).catch(() => {});
    await queryInterface.addColumn('stations', 'require_shift_for_readings', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    }).catch(() => {});
    await queryInterface.addColumn('stations', 'alert_on_missed_readings', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    }).catch(() => {});
    await queryInterface.addColumn('stations', 'missed_reading_threshold_days', {
      type: Sequelize.INTEGER,
      defaultValue: 1
    }).catch(() => {});

    // Patch enum_plans_name if needed (add 'Enterprise')
    try {
      await queryInterface.sequelize.query(
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'enum_plans_name' AND e.enumlabel = 'Enterprise') THEN ALTER TYPE enum_plans_name ADD VALUE 'Enterprise'; END IF; END $$;"
      );
    } catch (e) {
      // Ignore if already exists or enum doesn't exist
    }
  },

  async down(queryInterface, Sequelize) {
    // No-op: Do not remove columns or enum values in down migration for safety
  }
};
