"use strict";

/**
 * Migration: Fix enum_shifts_status to allow 'ended' value
 * This migration updates the enum type for the status column in the shifts table
 * to include 'ended' instead of 'completed'.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Rename the old enum type
    await queryInterface.sequelize.query('ALTER TYPE "enum_shifts_status" RENAME TO "enum_shifts_status_old";');

    // 2. Create the new enum type with the correct values
    await queryInterface.sequelize.query('CREATE TYPE "enum_shifts_status" AS ENUM (\'active\', \'ended\', \'cancelled\');');

    // 3. Alter the column to use the new enum type
    await queryInterface.sequelize.query(`
      ALTER TABLE "shifts" 
      ALTER COLUMN "status" DROP DEFAULT, 
      ALTER COLUMN "status" TYPE "enum_shifts_status" USING status::text::"enum_shifts_status",
      ALTER COLUMN "status" SET DEFAULT 'active';
    `);

    // 4. Drop the old enum type
    await queryInterface.sequelize.query('DROP TYPE "enum_shifts_status_old";');
  },

  async down(queryInterface, Sequelize) {
    // 1. Rename the current enum type
    await queryInterface.sequelize.query('ALTER TYPE "enum_shifts_status" RENAME TO "enum_shifts_status_new";');

    // 2. Recreate the old enum type
    await queryInterface.sequelize.query('CREATE TYPE "enum_shifts_status" AS ENUM (\'active\', \'completed\', \'cancelled\');');

    // 3. Alter the column to use the old enum type
    await queryInterface.sequelize.query(`
      ALTER TABLE "shifts" 
      ALTER COLUMN "status" DROP DEFAULT, 
      ALTER COLUMN "status" TYPE "enum_shifts_status" USING status::text::"enum_shifts_status",
      ALTER COLUMN "status" SET DEFAULT 'active';
    `);

    // 4. Drop the new enum type
    await queryInterface.sequelize.query('DROP TYPE "enum_shifts_status_new";');
  }
};
