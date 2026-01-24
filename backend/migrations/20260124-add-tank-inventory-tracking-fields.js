"use strict";

/**
 * Migration: Add Tank Inventory Tracking Fields
 * 
 * Purpose: Support real-time tank level tracking with "since last refill" visibility
 * 
 * New Fields:
 * - display_fuel_name: Custom fuel name (MSD, HSM, XP 95) for owner display
 * - level_after_last_refill: Tank level immediately after the most recent refill
 * - last_refill_date: Date of the most recent refill
 * - last_refill_amount: Litres added in the most recent refill
 * 
 * These fields enable:
 * 1. Calculating "sales since last refill" = level_after_last_refill - current_level
 * 2. Showing owner-friendly fuel names while keeping standard fuel_type for logic
 * 3. Giving owners visibility into tank activity since last refill
 * 
 * @see TANK_INVENTORY_SOLUTION.md for full design documentation
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ============================================
      // 1. Add display_fuel_name column
      // Custom fuel name like "MSD", "HSM", "XP 95" for owner display
      // ============================================
      await queryInterface.addColumn("tanks", "display_fuel_name", {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: "Custom fuel display name (e.g., MSD, HSM, XP 95). Falls back to fuelType if null."
      }, { transaction });

      // ============================================
      // 2. Add level_after_last_refill column
      // Stores the level right after the most recent refill
      // Used to calculate: sales_since_last_refill = level_after_last_refill - current_level
      // ============================================
      await queryInterface.addColumn("tanks", "level_after_last_refill", {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        comment: "Tank level immediately after last refill. Used to calculate sales since last refill."
      }, { transaction });

      // ============================================
      // 3. Add last_refill_date column
      // Stores when the most recent refill occurred
      // ============================================
      await queryInterface.addColumn("tanks", "last_refill_date", {
        type: Sequelize.DATEONLY,
        allowNull: true,
        comment: "Date of the most recent refill. Used for 'since last refill' tracking."
      }, { transaction });

      // ============================================
      // 4. Add last_refill_amount column
      // Stores how many litres were added in the most recent refill
      // ============================================
      await queryInterface.addColumn("tanks", "last_refill_amount", {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        comment: "Litres added in the most recent refill."
      }, { transaction });

      // ============================================
      // 5. Update currentLevel validation to allow negative values
      // Negative level = alert to owner that they forgot to enter a refill
      // ============================================
      // Note: The model already has allowNegative flag, 
      // but we need to update the column constraint
      await queryInterface.changeColumn("tanks", "current_level", {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Current fuel level in litres. Can be negative (indicates missed refill entry)."
      }, { transaction });

      await transaction.commit();
      console.log("✅ Migration complete: Tank inventory tracking fields added");

    } catch (error) {
      await transaction.rollback();
      console.error("❌ Migration failed:", error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove columns in reverse order
      await queryInterface.removeColumn("tanks", "last_refill_amount", { transaction });
      await queryInterface.removeColumn("tanks", "last_refill_date", { transaction });
      await queryInterface.removeColumn("tanks", "level_after_last_refill", { transaction });
      await queryInterface.removeColumn("tanks", "display_fuel_name", { transaction });

      // Restore currentLevel constraint (optional - min: 0)
      await queryInterface.changeColumn("tanks", "current_level", {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Current estimated fuel level in litres"
      }, { transaction });

      await transaction.commit();
      console.log("✅ Rollback complete: Tank inventory tracking fields removed");

    } catch (error) {
      await transaction.rollback();
      console.error("❌ Rollback failed:", error);
      throw error;
    }
  }
};
