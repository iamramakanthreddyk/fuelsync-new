'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Predefined plans that should remain
    const predefinedPlans = ['Free', 'Basic', 'Premium', 'Enterprise'];

    // First, reassign users with custom plans to 'Free' plan
    await queryInterface.sequelize.query(`
      UPDATE users
      SET plan_id = (
        SELECT id FROM plans WHERE name = 'Free' LIMIT 1
      )
      WHERE plan_id IN (
        SELECT id FROM plans WHERE name NOT IN ('Free', 'Basic', 'Premium', 'Enterprise')
      )
    `);

    // Also update stations that reference custom plans
    await queryInterface.sequelize.query(`
      UPDATE stations
      SET plan_id = (
        SELECT id FROM plans WHERE name = 'Free' LIMIT 1
      )
      WHERE plan_id IN (
        SELECT id FROM plans WHERE name NOT IN ('Free', 'Basic', 'Premium', 'Enterprise')
      )
    `);

    // Delete custom plans
    await queryInterface.bulkDelete('plans', {
      name: {
        [Sequelize.Op.notIn]: predefinedPlans
      }
    });
  },

  async down (queryInterface, Sequelize) {
    // This migration removes custom plans, so down migration would need to recreate them
    // Since we don't know what custom plans existed, we'll leave this empty
    // In a production environment, you might want to backup custom plans before running this migration
  }
};
