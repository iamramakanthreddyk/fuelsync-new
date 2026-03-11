/**
 * Credit Allocation Service
 * Handles credit transaction creation and creditor balance updates
 * Fixes N+1 query pattern by batching creditor lookups
 */

const { CreditTransaction, Creditor, sequelize } = require('../models');
const { VALIDATION_ERRORS } = require('../config/transactionConstants');

/**
 * Process credit allocations atomically:
 * 1. Validate all creditors exist and have sufficient credit limit
 * 2. Create CreditTransaction records
 * 3. Update creditor balances
 * 
 * @param {Object} params - { stationId, creditAllocations, transactionDate, readingIds, notes, userId, transaction }
 * @returns {Array} - Created CreditTransaction records
 * @throws {Error} - If creditor validation fails
 */
exports.processCreditAllocations = async (params) => {
  const {
    stationId,
    creditAllocations = [],
    transactionDate,
    readingIds = [],
    notes = '',
    userId,
    transaction: dbTransaction
  } = params;

  // Return empty array if no allocations
  if (!Array.isArray(creditAllocations) || creditAllocations.length === 0) {
    return [];
  }

  // Step 1: Batch-fetch all creditors (fixes N+1 issue)
  const creditorIds = creditAllocations.map(c => c.creditorId).filter(Boolean);
  
  if (creditorIds.length === 0) {
    return [];
  }

  const findOptions = { transaction: dbTransaction };
  if (sequelize.getDialect() !== 'sqlite') {
    findOptions.lock = dbTransaction.LOCK.UPDATE;
  }

  const creditors = await Creditor.findAll({
    where: { id: creditorIds },
    ...findOptions
  });

  // Validate all creditors found
  if (creditors.length !== creditorIds.length) {
    throw new Error(VALIDATION_ERRORS.CREDITOR_NOT_FOUND);
  }

  // Create a map for quick lookups
  const creditorMap = {};
  creditors.forEach(c => {
    creditorMap[c.id] = c;
  });

  // Step 2: Validate all allocations before creating any transactions
  for (const alloc of creditAllocations) {
    const creditorId = alloc.creditorId;
    const allocAmount = parseFloat(alloc.amount || 0);

    if (!creditorId) continue;

    // Validate amount is positive
    if (allocAmount <= 0) {
      throw new Error('Credit allocation amount must be positive');
    }

    const creditor = creditorMap[creditorId];
    if (!creditor) {
      throw new Error(VALIDATION_ERRORS.CREDITOR_NOT_FOUND_FOR_ALLOCATION);
    }

    // Verify creditor belongs to station
    if (String(creditor.stationId) !== String(stationId)) {
      throw new Error(VALIDATION_ERRORS.CREDITOR_NOT_FOUND_FOR_ALLOCATION);
    }

    // Verify creditor is active
    if (!creditor.isActive) {
      throw new Error(`Creditor ${creditor.name} is inactive and cannot take credit`);
    }

    // Verify credit limit
    if (!creditor.canTakeCredit(allocAmount)) {
      throw new Error(`${VALIDATION_ERRORS.CREDIT_LIMIT_EXCEEDED} for ${creditor.name}`);
    }
  }

  // Step 3: Create credit transactions and update balances
  const createdCreditTxns = [];

  for (const alloc of creditAllocations) {
    const creditorId = alloc.creditorId;
    const allocAmount = parseFloat(alloc.amount || 0);

    if (!creditorId || !allocAmount || allocAmount <= 0) continue;

    const creditor = creditorMap[creditorId];

    // Create CreditTransaction record
    const creditTxn = await CreditTransaction.create({
      stationId,
      creditorId,
      transactionType: 'credit',
      amount: allocAmount,
      transactionDate: transactionDate || new Date().toISOString().split('T')[0],
      notes: notes || null,
      nozzleReadingId: readingIds && readingIds.length > 0 ? readingIds[0] : null,
      enteredBy: userId
    }, { transaction: dbTransaction });

    // Update creditor balance
    await creditor.update({
      currentBalance: parseFloat(creditor.currentBalance) + allocAmount,
      lastTransactionDate: new Date()
    }, { transaction: dbTransaction });

    createdCreditTxns.push(creditTxn);
  }

  return createdCreditTxns;
};

/**
 * Format credit allocations for persistence in DailyTransaction
 * @param {Array} creditAllocations - [{ creditorId, amount }]
 * @returns {Array} - Formatted allocations
 */
exports.formatCreditAllocationsForStorage = (creditAllocations = []) => {
  return (creditAllocations || [])
    .map(c => ({
      creditorId: c.creditorId || c.creditor_id,
      amount: parseFloat(c.amount || 0)
    }))
    .filter(c => c.creditorId && c.amount > 0);
};
