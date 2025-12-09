"use strict";

/**
 * Migration: Rename user role enum value 'pump_owner' to 'owner'
 *
 * This migration performs a safe transformation for Postgres-backed Sequelize
 * setups. It works in three steps:
 * 1) Add a new enum label 'owner' to the underlying Postgres type.
 * 2) Update existing rows in `users` that have role='pump_owner' -> 'owner'.
 * 3) Remove the old enum label 'pump_owner' from the type.
 *
 * The migration is Postgres-specific because altering enum types is DB-vendor
 * specific. The migration includes a rollback which attempts to reverse the
 * change by re-adding 'pump_owner', converting rows back, and removing 'owner'.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // This migration is Postgres-specific; validate dialect
    if (queryInterface.sequelize.options.dialect !== 'postgres') {
      throw new Error('This migration only supports Postgres dialect.');
    }

    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Step 1: add new enum value 'owner' to the existing enum type
      // The enum type name is created by Sequelize when the table was created.
      // By default, it's 'enum_users_role' for the users.role column.
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_users_role\" ADD VALUE IF NOT EXISTS 'owner';",
        { transaction }
      );

      // Step 2: update existing user rows with the old value to the new value
      await queryInterface.bulkUpdate(
        'users',
        { role: 'owner' },
        { role: 'pump_owner' },
        { transaction }
      );

      // Step 3: remove the old enum value by recreating the enum type without it
      // Postgres doesn't support removing a value directly; workaround:
      //  - create a new enum type with desired values
      //  - alter the column to use the new type
      //  - drop the old type

      // 3a) create the temporary enum type
      await queryInterface.sequelize.query(
        "CREATE TYPE \"enum_users_role_new\" AS ENUM ('super_admin','owner','manager','employee');",
        { transaction }
      );

      // 3b) alter the column to use the new type (using casting)
      await queryInterface.sequelize.query(
        'ALTER TABLE "users" ALTER COLUMN "role" TYPE "enum_users_role_new" USING role::text::enum_users_role_new;',
        { transaction }
      );

      // 3c) drop the old enum type and rename the new one to the original name
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_users_role";',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_users_role_new" RENAME TO "enum_users_role";',
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    if (queryInterface.sequelize.options.dialect !== 'postgres') {
      throw new Error('This migration only supports Postgres dialect.');
    }

    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Rollback steps: re-create the previous enum including 'pump_owner',
      // convert rows back, then restore type name.

      // 1) create old-style enum with pump_owner
      await queryInterface.sequelize.query(
        "CREATE TYPE \"enum_users_role_old\" AS ENUM ('super_admin','pump_owner','manager','employee');",
        { transaction }
      );

      // 2) alter column to use old enum type
      await queryInterface.sequelize.query(
        'ALTER TABLE "users" ALTER COLUMN "role" TYPE "enum_users_role_old" USING role::text::enum_users_role_old;',
        { transaction }
      );

      // 3) update rows that were converted to 'owner' back to 'pump_owner'
      await queryInterface.bulkUpdate(
        'users',
        { role: 'pump_owner' },
        { role: 'owner' },
        { transaction }
      );

      // 4) drop current enum type and rename the old back to original name
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_users_role";',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_users_role_old" RENAME TO "enum_users_role";',
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
