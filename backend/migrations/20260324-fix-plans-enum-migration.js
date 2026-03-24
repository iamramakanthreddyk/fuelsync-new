'use strict';

/**
 * Migration: Fix plans.name ENUM type change
 * 
 * Fixes PostgreSQL syntax error when changing ENUM type with UNIQUE constraint.
 * PostgreSQL doesn't allow UNIQUE in ALTER COLUMN TYPE statements.
 * 
 * Approach:
 * 1. Drop the unique constraint if it exists
 * 2. Change the column type to support 'Enterprise' value
 * 3. Re-create the unique constraint
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // First, check if the constraint exists and drop it
      await queryInterface.sequelize.query(`
        ALTER TABLE "plans" DROP CONSTRAINT IF EXISTS "plans_name_key";
      `).catch(() => {
        // Constraint might not exist, continue
      });

      // Create the new ENUM type if it doesn't exist
      await queryInterface.sequelize.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_plans_name') THEN
            CREATE TYPE "public"."enum_plans_name" AS ENUM('Free', 'Basic', 'Premium', 'Enterprise');
          ELSE
            -- Add 'Enterprise' value if it doesn't exist
            IF NOT EXISTS (
              SELECT 1 FROM pg_type t 
              JOIN pg_enum e ON t.oid = e.enumtypid 
              WHERE t.typname = 'enum_plans_name' AND e.enumlabel = 'Enterprise'
            ) THEN
              ALTER TYPE "public"."enum_plans_name" ADD VALUE 'Enterprise';
            END IF;
          END IF;
        END $$;
      `).catch(() => {
        // Type might already exist, continue
      });

      // Change the column type WITHOUT the UNIQUE keyword
      await queryInterface.sequelize.query(`
        ALTER TABLE "plans" 
        ALTER COLUMN "name" 
        TYPE "public"."enum_plans_name" 
        USING "name"::"public"."enum_plans_name";
      `);

      // Re-add the unique constraint as a separate statement
      await queryInterface.sequelize.query(`
        ALTER TABLE "plans" 
        ADD CONSTRAINT "plans_name_key" UNIQUE ("name");
      `).catch(() => {
        // Constraint might already exist, that's fine
      });

    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // Rollback: change back to old ENUM
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE "plans" 
        ALTER COLUMN "name" 
        TYPE "public"."enum_plans_name_old" 
        USING CASE 
          WHEN "name"::text = 'Enterprise' THEN 'Free'::text 
          ELSE "name"::text 
        END::"public"."enum_plans_name_old";
      `).catch(() => {
        // If old type doesn't exist, we can't rollback cleanly
      });
    } catch (error) {
      console.warn('Rollback skipped - old enum type not available');
    }
  }
};
