"use strict";

/**
 * Migration: Add stations.owner_id and backfill from users.station_id
 * - Adds nullable owner_id (UUID) referencing users(id)
 * - Adds index on owner_id
 * - Backfills owner_id where a user with role 'owner' or 'pump_owner' has station_id equal to station id
 * - Creates a small review table `stations_owner_backfill_review` with stations still missing owner_id
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1) add the owner_id column if it doesn't exist
      const desc = await queryInterface.describeTable('stations');
      if (!desc.owner_id) {
        await queryInterface.addColumn(
          'stations',
          'owner_id',
          {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          },
          { transaction }
        );
      }

      // 2) add index for owner_id
      try {
        await queryInterface.addIndex('stations', ['owner_id'], { name: 'idx_stations_owner_id', transaction });
      } catch (e) {
        // ignore if exists
      }

      // 3) Best-effort backfill: if a user has station_id = stations.id and role owner, set as owner
      await queryInterface.sequelize.query(
        `UPDATE stations SET owner_id = u.id
         FROM users u
         WHERE stations.owner_id IS NULL
           AND u.station_id = stations.id
           AND (u.role = 'owner')`
        , { transaction }
      );

      // 4) Create a review table listing stations still missing owner for manual review
      await queryInterface.sequelize.query(
        `CREATE TABLE IF NOT EXISTS stations_owner_backfill_review (
           station_id uuid PRIMARY KEY,
           station_name text,
           reason text,
           detected_at timestamptz NOT NULL DEFAULT now()
         );`,
        { transaction }
      );

      // populate review table with stations that still don't have owner_id
      await queryInterface.sequelize.query(
        `INSERT INTO stations_owner_backfill_review (station_id, station_name, reason)
         SELECT id, name, 'no owner matched during backfill' FROM stations WHERE owner_id IS NULL
         ON CONFLICT (station_id) DO NOTHING;`,
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // drop review table
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS stations_owner_backfill_review;', { transaction });

      // remove index
      try {
        await queryInterface.removeIndex('stations', 'idx_stations_owner_id', { transaction });
      } catch (e) {
        // ignore if index doesn't exist
      }

      // remove column
      await queryInterface.removeColumn('stations', 'owner_id', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
