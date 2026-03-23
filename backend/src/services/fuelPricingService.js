/**
 * Fuel Pricing Service
 * 
 * Business logic for fuel price management and historical tracking.
 * Responsibilities:
 * - Price querying (current and historical)
 * - Price creation with cost tracking
 * - Price verification for transactions
 * - Profit margin calculations
 */

const { FuelPrice, Station } = require('./modelAccess');
const { Op } = require('sequelize');
const { logAudit } = require('../utils/auditLog');
const { createContextLogger } = require('./loggerService');

const logger = createContextLogger('FuelPricingService');

/**
 * Get all fuel prices for a station (current and historical)
 * 
 * Returns:
 * - current: Latest price for each fuel type
 * - history: All prices ordered by date (most recent first)
 * - Includes: price, costPrice, profit (margin), effectiveFrom
 * 
 * @param {string} stationId - Station ID
 * @returns {Promise<Object>} Prices organized by current/history
 */
async function getFuelPrices(stationId) {
  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new Error('Station not found');
  }

  // Get all prices for station
  const prices = await FuelPrice.findAll({
    where: { stationId },
    order: [['effectiveFrom', 'DESC']]
  });

  if (prices.length === 0) {
    logger.warn('No fuel prices found for station', { stationId });
    return {
      stationId,
      current: {},
      history: []
    };
  }

  // Group by fuel type to find current prices
  const currentPrices = {};
  const fuelTypes = new Set();

  prices.forEach(price => {
    fuelTypes.add(price.fuelType);
    if (!currentPrices[price.fuelType]) {
      currentPrices[price.fuelType] = {
        fuelType: price.fuelType,
        price: price.price,
        costPrice: price.costPrice,
        profit: price.price - (price.costPrice || 0),
        effectiveFrom: price.effectiveFrom,
        createdAt: price.createdAt
      };
    }
  });

  // Add missing fuel types to current
  const currentPricesArray = Object.values(currentPrices);

  logger.debug('Retrieved fuel prices', { 
    stationId, 
    fuelTypesCount: fuelTypes.size,
    historicalCount: prices.length 
  });

  return {
    stationId,
    current: currentPricesArray,
    history: prices.map(p => ({
      fuelType: p.fuelType,
      price: p.price,
      costPrice: p.costPrice,
      profit: p.price - (p.costPrice || 0),
      effectiveFrom: p.effectiveFrom,
      createdAt: p.createdAt
    }))
  };
}

/**
 * Set a new fuel price for a station
 * 
 * Business Logic:
 * - Creates new price record with effectiveFrom timestamp
 * - Maintains price history (doesn't overwrite, creates new entry)
 * - Calculates and stores profit margin (price - costPrice)
 * - Records audit log for price change
 * 
 * Pricing Model:
 * - price: Retail selling price per litre (₹)
 * - costPrice: Cost to procure per litre (₹)
 * - profit: Automatically calculated (price - costPrice)
 * - effectiveFrom: When this price became active
 * 
 * @param {string} stationId - Station ID
 * @param {Object} dto - Price data
 * @param {string} dto.fuelType - Fuel type (e.g., 'diesel', 'petrol')
 * @param {number} dto.price - Selling price per litre
 * @param {number} dto.costPrice - Cost price per litre (optional)
 * @param {string} userId - User setting the price
 * @returns {Promise<Object>} Created price record
 */
async function setFuelPrice(stationId, dto, userId) {
  const { fuelType, price, costPrice } = dto;

  // Validate inputs
  if (!fuelType) {
    throw new Error('Fuel type is required');
  }
  if (price === undefined || price === null) {
    throw new Error('Price is required');
  }

  // Convert price to number and validate
  const numericPrice = Number(price);
  if (isNaN(numericPrice) || numericPrice <= 0) {
    throw new Error('Price must be a positive number');
  }

  // Convert and validate cost price if provided
  let numericCostPrice = 0;
  if (costPrice !== undefined && costPrice !== null && costPrice !== '') {
    numericCostPrice = Number(costPrice);
    if (isNaN(numericCostPrice) || numericCostPrice <= 0) {
      throw new Error('Cost price must be a positive number');
    }
    if (numericCostPrice >= numericPrice) {
      throw new Error('Cost price must be less than selling price');
    }
  }

  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new Error('Station not found');
  }

  // Create new price record
  const fuelPrice = await FuelPrice.create({
    stationId,
    fuelType,
    price: numericPrice,
    costPrice: numericCostPrice,
    effectiveFrom: new Date()
  });

  logAudit({
    userId,
    action: 'FUEL_PRICE_SET',
    resourceType: 'FuelPrice',
    resourceId: fuelPrice.id,
    changes: {
      created: {
        stationId,
        fuelType,
        sellingPrice: price,
        costPrice: costPrice || 0,
        profit: price - (costPrice || 0)
      }
    }
  });

  logger.info('Fuel price set', { 
    stationId, 
    fuelType, 
    price,
    costPrice: costPrice || 0
  });

  return {
    id: fuelPrice.id,
    stationId: fuelPrice.stationId,
    fuelType: fuelPrice.fuelType,
    price: fuelPrice.price,
    costPrice: fuelPrice.costPrice,
    profit: fuelPrice.price - fuelPrice.costPrice,
    effectiveFrom: fuelPrice.effectiveFrom,
    createdAt: fuelPrice.createdAt
  };
}

/**
 * Check if fuel prices are configured for a station
 * 
 * Verifies that the station has at least one price configured
 * for each required fuel type. Used before processing transactions.
 * 
 * @param {string} stationId - Station ID
 * @param {Array<string>} requiredFuelTypes - Fuel types to verify
 * @returns {Promise<boolean>} True if all required prices are set
 */
async function checkPriceSet(stationId, requiredFuelTypes = []) {
  const station = await Station.findByPk(stationId);
  if (!station) {
    throw new Error('Station not found');
  }

  // If no specific fuel types required, just check if ANY price exists
  if (!requiredFuelTypes || requiredFuelTypes.length === 0) {
    const priceExists = await FuelPrice.count({
      where: { stationId }
    });
    return priceExists > 0;
  }

  // Check for each required fuel type
  for (const fuelType of requiredFuelTypes) {
    const priceCount = await FuelPrice.count({
      where: { stationId, fuelType }
    });
    if (priceCount === 0) {
      logger.warn('Price not configured', { stationId, fuelType });
      return false;
    }
  }

  return true;
}

/**
 * Check price for a specific fuel type on a specific date
 * 
 * @param {string} stationId - Station ID
 * @param {string} fuelType - Fuel type to check
 * @param {string} checkDate - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Price info { fuelType, date, priceSet, price, message }
 */
async function checkPriceForDate(stationId, fuelType, checkDate) {
  if (!stationId || !fuelType || !checkDate) {
    throw new Error('stationId, fuelType, and checkDate are required');
  }

  const validFuelTypes = Object.values(FUEL_TYPES);
  if (!validFuelTypes.includes(fuelType)) {
    throw new Error(`Invalid fuel type. Must be one of: ${validFuelTypes.join(', ')}`);
  }

  const price = await FuelPrice.getPriceForDate(stationId, fuelType, checkDate);

  return {
    fuelType,
    date: checkDate,
    priceSet: price !== null,
    price: price,
    message: price !== null 
      ? `Price for ${fuelType} on ${checkDate}: ₹${price}` 
      : `No price set for ${fuelType} on or before ${checkDate}`
  };
}

/**
 * Get current price for a specific fuel type
 * 
 * Returns the most recent (active) price for the given fuel type.
 * Used during transaction processing to calculate amounts.
 * 
 * @param {string} stationId - Station ID
 * @param {string} fuelType - Fuel type to find
 * @returns {Promise<Object>} Current price record
 * @throws {Error} If fuel type has no prices
 */
async function getCurrentPrice(stationId, fuelType) {
  const price = await FuelPrice.findOne({
    where: { stationId, fuelType },
    order: [['effectiveFrom', 'DESC']]
  });

  if (!price) {
    throw new Error(`No price configured for ${fuelType} at this station`);
  }

  return {
    id: price.id,
    price: price.price,
    costPrice: price.costPrice,
    profit: price.price - price.costPrice,
    effectiveFrom: price.effectiveFrom
  };
}

/**
 * Get price history for a fuel type
 * 
 * @param {string} stationId - Station ID
 * @param {string} fuelType - Fuel type
 * @param {number} limit - Max records to return (default: 50)
 * @returns {Promise<Array>} Historical prices ordered by date (recent first)
 */
async function getPriceHistory(stationId, fuelType, limit = 50) {
  const prices = await FuelPrice.findAll({
    where: { stationId, fuelType },
    order: [['effectiveFrom', 'DESC']],
    limit,
    raw: true
  });

  return prices.map(p => ({
    price: p.price,
    costPrice: p.costPrice,
    profit: p.price - p.costPrice,
    effectiveFrom: p.effectiveFrom,
    createdAt: p.createdAt
  }));
}

module.exports = {
  getFuelPrices,
  setFuelPrice,
  checkPriceSet,
  checkPriceForDate,
  getCurrentPrice,
  getPriceHistory
};
