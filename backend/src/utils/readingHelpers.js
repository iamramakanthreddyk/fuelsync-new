/**
 * Reading Utilities & Helpers
 * Shared functions for reading calculations and formatting
 * Consolidates helpers previously scattered across controllers
 */

/**
 * Calculate deduplicated payment totals across readings
 * Prevents double-counting of payment breakdowns when readings share transactions
 * 
 * Accepts either raw NozzleReading DB objects or mapped reading objects
 * Returns aggregated: { cash, online, credit, litres, value }
 * 
 * @param {Array} items - Array of reading objects
 * @returns {Object} Deduplicated totals
 */
function calculateDeduplicatedTotals(items) {
  const seen = new Set();
  const acc = { cash: 0, online: 0, credit: 0, litres: 0, value: 0 };

  items.forEach((r) => {
    const litres = parseFloat(r.litresSold || r.litres || 0) || 0;
    const value = parseFloat(r.saleValue || r.totalAmount || r.value || 0) || 0;
    acc.litres += litres;
    acc.value += value;

    const cash = parseFloat(
      (r.cashAmount ?? r.cash ?? (r.transaction && r.transaction.paymentBreakdown && r.transaction.paymentBreakdown.cash) ?? 0) || 0
    );
    const online = parseFloat(
      (r.onlineAmount ?? r.online ?? (r.transaction && r.transaction.paymentBreakdown && r.transaction.paymentBreakdown.online) ?? 0) || 0
    );
    const credit = parseFloat(
      (r.creditAmount ?? r.credit ?? (r.transaction && r.transaction.paymentBreakdown && r.transaction.paymentBreakdown.credit) ?? 0) || 0
    );

    // Use assignedEmployeeId (responsible employee) for dedup key
    const employeeId = r.assignedEmployeeId || (r.recordedBy && r.recordedBy.id) || r.enteredBy || (r.enteredByUser && r.enteredByUser.id) || r.createdBy || 'unknown';

    if (cash > 0 || online > 0 || credit > 0) {
      const key = `${employeeId}|${cash.toFixed(2)}|${online.toFixed(2)}|${credit.toFixed(2)}`;
      if (!seen.has(key)) {
        seen.add(key);
        acc.cash += cash;
        acc.online += online;
        acc.credit += credit;
      }
    } else {
      const legacyKey = `legacy|${r.id}`;
      if (!seen.has(legacyKey)) {
        seen.add(legacyKey);
        acc.cash += value;
      }
    }
  });

  return acc;
}

/**
 * Format reading data for API response
 * Ensures consistent structure across different reading sources
 * 
 * @param {Object} reading - Raw reading object from database
 * @returns {Object} Formatted reading object
 */
function formatReadingResponse(reading) {
  if (!reading) return null;
  
  const formatted = {
    id: reading.id,
    nozzleId: reading.nozzleId,
    readingValue: parseFloat(reading.readingValue) || 0,
    previousReading: parseFloat(reading.previousReading) || 0,
    litresSold: parseFloat(reading.litresSold) || 0,
    pricePerLitre: parseFloat(reading.pricePerLitre) || 0,
    totalAmount: parseFloat(reading.totalAmount) || 0,
    readingDate: reading.readingDate,
    isSample: !!reading.isSample,
    notes: reading.notes || null,
    createdAt: reading.createdAt,
    updatedAt: reading.updatedAt,
  };

  // Include relations if available
  if (reading.enteredByUser) {
    formatted.enteredBy = {
      id: reading.enteredByUser.id,
      name: reading.enteredByUser.name,
      email: reading.enteredByUser.email,
    };
  }

  if (reading.assignedEmployee) {
    formatted.assignedEmployee = {
      id: reading.assignedEmployee.id,
      name: reading.assignedEmployee.name,
    };
  }

  if (reading.nozzle) {
    formatted.nozzle = {
      id: reading.nozzle.id,
      name: reading.nozzle.name,
      number: reading.nozzle.nozzleNumber,
      fuelType: reading.nozzle.fuelType,
      status: reading.nozzle.status,
    };
  }

  return formatted;
}

/**
 * Validate reading value against previous reading
 * Checks for meter rollback, unusual jumps, etc.
 * 
 * @param {number} currentValue - Current meter reading
 * @param {number} previousValue - Previous meter reading
 * @param {number} tolerance - Tolerance for jump detection (percentage)
 * @returns {Object} { isValid, warnings, errors }
 */
function validateReadingSequence(currentValue, previousValue, tolerance = 500) {
  const current = parseFloat(currentValue) || 0;
  const previous = parseFloat(previousValue) || 0;
  const delta = current - previous;

  const result = {
    isValid: true,
    warnings: [],
    errors: [],
  };

  // Meter cannot go backwards (unless wrapped/reset)
  if (delta < 0 && Math.abs(delta) > 1000) {
    result.errors.push(`Meter rollback detected: ${previous} → ${current}`);
    result.isValid = false;
  }

  // Warn on large jumps
  if (delta > 0 && tolerance > 0) {
    const jumpPercentage = (delta / Math.max(previous, 1)) * 100;
    if (jumpPercentage > tolerance) {
      result.warnings.push(`Unusual jump: ${((delta / Math.max(previous, 1)) * 100).toFixed(1)}% increase`);
    }
  }

  return result;
}

/**
 * Calculate sale value from reading data
 * Handles sample readings (zero value) vs actual sales
 * 
 * @param {Object} reading - Reading object
 * @returns {number} Sale value in rupees
 */
function calculateSaleValue(reading) {
  if (reading.isSample) return 0;
  return parseFloat(reading.totalAmount) || 0;
}

/**
 * Calculate litres sold from revenue and price
 * Useful for validation and verification
 * 
 * @param {number} revenue - Total sale amount
 * @param {number} pricePerLitre - Price per litre
 * @returns {number} Calculated litres
 */
function calculateLitresSold(revenue, pricePerLitre) {
  if (!pricePerLitre || pricePerLitre <= 0) return 0;
  return parseFloat(revenue) / parseFloat(pricePerLitre);
}

module.exports = {
  calculateDeduplicatedTotals,
  formatReadingResponse,
  validateReadingSequence,
  calculateSaleValue,
  calculateLitresSold,
};
