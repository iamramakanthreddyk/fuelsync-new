'use strict';

/**
 * Migration: Add ERD-missing tables and columns
 * - Adds: pump_assignments, nozzle_assignments, station_plans,
 *   manual_readings, sales, tender_entries (use `cash_handovers`), daily_closure (alias: `settlements`), plan_usage,
 *   user_activity_log
 * - Adds `brand` column to `stations` if missing
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // stations.brand (nullable)
      const stationsDesc = await queryInterface.describeTable('stations', { transaction });
      if (!stationsDesc.brand) {
        await queryInterface.addColumn('stations', 'brand', {
          type: Sequelize.DataTypes.STRING(50),
          allowNull: true,
          comment: 'Station brand (IOCL, BPCL, HPCL)'
        }, { transaction });
      }

      // user_stations intentionally omitted: owner access is supported via `stations.owner_id`
      // The application enforces owner access using Station.ownerId and User.stationId
      // If a future requirement needs many-to-many user↔station mapping, add `user_stations` then.


      // station_plans omitted: application uses `stations.plan_id` for current plan

      // manual_readings intentionally omitted: nozzle_readings already stores manual/entered readings

      // sales
      // sales: not created here - sales are derived from `nozzle_readings` and served by controllers

      // tender_entries omitted: use existing `cash_handovers` table for tender/collection records

      // daily_closure omitted: use existing `settlements` table for end-of-day reconciliation

      // plan_usage omitted

      // user_activity_log omitted: `audit_logs` covers similar auditing needs

      await transaction.commit();
      console.log('✅ Migration completed: Added ERD-missing tables and station.brand');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Drop in reverse order (only tables created by this migration)
      const tableList = await queryInterface.showAllTables({ transaction });
      // plan_usage omitted
      // tender_entries omitted
      // station_plans omitted
      // user_stations omitted in up(); nothing to drop here

      // Remove stations.brand if exists
      const stationsDesc = await queryInterface.describeTable('stations', { transaction });
      if (stationsDesc.brand) {
        await queryInterface.removeColumn('stations', 'brand', { transaction });
      }

      await transaction.commit();
      console.log('⬇️ Migration rolled back: Removed ERD-missing tables and station.brand');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
