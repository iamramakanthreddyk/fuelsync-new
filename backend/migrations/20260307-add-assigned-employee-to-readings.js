'use strict';

/**
 * Migration: Add assigned_employee_id to nozzle_readings
 * 
 * Supports Requirement 1: Manager/Owner can enter readings ON BEHALF of an employee.
 * 
 * - entered_by  = the person who physically typed the reading (always the logged-in user)
 * - assigned_employee_id = the employee this reading belongs to (optional, null = self-entry)
 *
 * When assigned_employee_id is set:
 *   - Reports attribute the reading to that employee
 *   - Shortfall calculations use assigned_employee_id as the responsible person
 *   - entered_by still records the manager/owner who entered it
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('nozzle_readings');

    if (!tableDescription.assigned_employee_id) {
      await queryInterface.addColumn('nozzle_readings', 'assigned_employee_id', {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: null,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Employee this reading belongs to (set by manager/owner entry on behalf of employee). NULL = entered by self.',
        after: 'entered_by'
      });
    }

    // Add index for efficient employee-based lookups and reports
    try {
      await queryInterface.addIndex('nozzle_readings', ['assigned_employee_id'], {
        name: 'idx_nozzle_readings_assigned_employee',
        where: { assigned_employee_id: { [Sequelize.Op.ne]: null } }
      });
    } catch (e) {
      // Index may already exist, non-fatal
      console.warn('[MIGRATION] Index idx_nozzle_readings_assigned_employee already exists, skipping');
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('nozzle_readings', 'idx_nozzle_readings_assigned_employee');
    } catch (e) {}
    await queryInterface.removeColumn('nozzle_readings', 'assigned_employee_id');
  }
};
