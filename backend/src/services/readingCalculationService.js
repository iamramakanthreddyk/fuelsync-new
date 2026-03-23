/**
 * Reading Calculation Service
 * Handles all reading-related calculations and derived data
 */

const { NozzleReading, FuelPrice } = require('../models');

/**
 * Resolve previous reading with fallbacks
 * - If backdated: get reading before specified date
 * - If current: get latest reading
 * - Fallback: use nozzle.initialReading
 * @param {string} nozzleId - Nozzle ID
 * @param {string} readingDate - Reading date (YYYY-MM-DD)
 * @param {string} nozzleInitialReading - Nozzle's initialReading value
 * @param {number} providedPreviousReading - Client-provided value (if any)
 * @param {string} stationId - Station ID (required for filtering)
 * @returns {Object} - { previousReading, previousReadingRecord }
 */
exports.resolvePreviousReading = async (nozzleId, readingDate, nozzleInitialReading, providedPreviousReading, stationId) => {
  // If client provided explicit previousReading, use it
  if (providedPreviousReading !== undefined) {
    return {
      previousReading: providedPreviousReading,
      previousReadingRecord: null
    };
  }

  // Determine if backdated entry
  const today = new Date().toISOString().split('T')[0];
  const isBackdated = new Date(readingDate + 'T00:00:00Z') < new Date(today + 'T00:00:00Z');

  // Get previous reading from database (filtered by stationId)
  let previousReadingRecord;
  if (isBackdated) {
    previousReadingRecord = await NozzleReading.getPreviousReading(nozzleId, readingDate, stationId);
  } else {
    previousReadingRecord = await NozzleReading.getLatestReading(nozzleId, stationId);
  }

  // Determine value: found reading > initialReading > 0
  let previousReading = previousReadingRecord?.readingValue;
  
  if (previousReading === undefined || previousReading === null) {
    previousReading = nozzleInitialReading !== undefined && nozzleInitialReading !== null
      ? nozzleInitialReading
      : 0;
  }

  return {
    previousReading: parseFloat(previousReading),
    previousReadingRecord
  };
};

/**
 * Calculate litres sold from meter readings
 * @param {number} currentValue - Current meter reading
 * @param {number} previousValue - Previous meter reading
 * @returns {number} - Litres sold (always >= 0)
 */
exports.calculateLitresSold = (currentValue, previousValue) => {
  return Math.max(0, parseFloat(currentValue) - parseFloat(previousValue));
};

/**
 * Resolve price per litre with fallbacks
 * - Client provided > DB fuel price > default
 * @param {number} clientProvidedPrice - Price provided in request
 * @param {number} dbFuelPrice - Price from FuelPrice table
 * @param {boolean} isInitialReading - If initial reading, default to 100
 * @returns {number} - Price per litre
 */
exports.resolvePricePerLitre = (clientProvidedPrice, dbFuelPrice, isInitialReading = false) => {
  if (clientProvidedPrice !== undefined && clientProvidedPrice !== null) {
    return parseFloat(clientProvidedPrice);
  }

  if (dbFuelPrice !== undefined && dbFuelPrice !== null) {
    return parseFloat(dbFuelPrice);
  }

  // Default: 100 for initial, 0 otherwise
  return isInitialReading ? 100 : 0;
};

/**
 * Calculate total amount from litres and price
 * @param {number} litresSold - Litres sold
 * @param {number} pricePerLitre - Price per litre
 * @returns {number} - Total amount
 */
exports.calculateTotalAmount = (litresSold, pricePerLitre) => {
  const litres = parseFloat(litresSold) || 0;
  const price = parseFloat(pricePerLitre) || 0;
  return litres * price;
};

/**
 * Populate all calculated reading fields
 * Single function that orchestrates all calculation logic
 * 
 * @param {Object} params - { nozzle, readingDate, normalizedInput, stationId }
 * @returns {Object} - { calculated field values }
 */
exports.populateReadingCalculations = async (params) => {
  const { nozzle, readingDate, normalizedInput, stationId } = params;

  // Resolve previous reading
  const { previousReading, previousReadingRecord } = await exports.resolvePreviousReading(
    nozzle.id,
    readingDate,
    nozzle.initialReading,
    normalizedInput.previousReading,
    stationId
  );

  // Determine if initial
  const isInitialReading = exports.determineIsInitial(previousReadingRecord, normalizedInput.previousReading);

  const currentValue = parseFloat(normalizedInput.readingValue);

  // Calculate litres sold
  const calculatedLitresSold = exports.calculateLitresSold(currentValue, previousReading);

  // Get fuel price from DB
  const dbFuelPrice = await FuelPrice.getPriceForDate(stationId, nozzle.fuelType, readingDate);

  // Resolve price per litre
  const calculatedPricePerLitre = exports.resolvePricePerLitre(
    normalizedInput.pricePerLitre,
    dbFuelPrice,
    isInitialReading
  );

  // Calculate total amount (with fallback to client-provided)
  let calculatedTotalAmount = normalizedInput.totalAmount !== undefined
    ? parseFloat(normalizedInput.totalAmount)
    : exports.calculateTotalAmount(calculatedLitresSold, calculatedPricePerLitre);

  return {
    currentValue,
    previousReading,
    isInitialReading,
    calculatedLitresSold,
    calculatedPricePerLitre,
    calculatedTotalAmount,
    previousReadingRecord,
    fuelType: nozzle.fuelType
  };
};

/**
 * Helper: Determine if reading is initial
 */
exports.determineIsInitial = (previousReadingRecord, providedPreviousReading) => {
  return !previousReadingRecord && (providedPreviousReading === undefined);
};

/**
 * Recalculate all readings after a specific date for a nozzle
 * Called when a reading is updated to recalculate cascading effect
 * @param {Array} allReadings - All readings for nozzle after date
 * @param {number} startingPreviousValue - Previous reading before this batch
 * @param {string} stationId - Station ID
 * @returns {Array} - Readings with updated calculations
 */
exports.recalculateReadingsBatch = async (allReadings, startingPreviousValue, stationId) => {
  const updates = [];
  let prevValue = startingPreviousValue;

  for (const reading of allReadings) {
    const currentValue = parseFloat(reading.readingValue);
    const litresSold = prevValue !== null ? (currentValue - prevValue) : 0;

    // Get price for this date
    const pricePerLitre = await FuelPrice.getPriceForDate(stationId, reading.fuelType, reading.readingDate) || 0;
    const totalAmount = litresSold * pricePerLitre;

    updates.push({
      id: reading.id,
      previousReading: prevValue,
      litresSold,
      pricePerLitre,
      totalAmount
    });

    prevValue = currentValue;
  }

  return updates;
};
