'use strict';

/**
 * Migration: Add payment_sub_breakdown to daily_transactions
 * 
 * Supports Requirement 2: Online payment sub-categories.
 *
 * The existing paymentBreakdown JSONB field stored: { cash: 0, online: 0, credit: 0 }
 * 
 * We add a new JSONB column `payment_sub_breakdown` to store detailed sub-types:
 * {
 *   cash: 5000,
 *   upi: {                         <- was "online"
 *     gpay: 1200,
 *     phonepe: 800,
 *     paytm: 0,
 *     other_upi: 0
 *   },
 *   card: {
 *     debit_card: 500,
 *     credit_card: 300
 *   },
 *   oil_company: {
 *     hp_pay: 0,
 *     iocl_card: 0,
 *     bpcl_smartfleet: 0,
 *     other_oil_company: 0
 *   },
 *   credit: 0                      <- creditor credit (unchanged)
 * }
 *
 * Strategy: Keep paymentBreakdown for backward compatibility. 
 * Now derive it by summing payment_sub_breakdown categories.
 * If payment_sub_breakdown is present, it is authoritative; paymentBreakdown is computed.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('daily_transactions');

    if (!tableDescription.payment_sub_breakdown) {
      await queryInterface.addColumn('daily_transactions', 'payment_sub_breakdown', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: 'Detailed payment sub-type breakdown: { cash, upi: {gpay, phonepe, ...}, card: {debit_card, credit_card}, oil_company: {hp_pay, iocl_card, ...}, credit }',
        after: 'payment_breakdown'
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('daily_transactions', 'payment_sub_breakdown');
  }
};
