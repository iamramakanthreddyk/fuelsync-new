/**
 * Fuel Pricing Controller
 * 
 * Handles fuel price management for stations.
 * Responsibilities:
 * - Get current and historical fuel prices
 * - Set/update fuel prices with cost price tracking
 * - Verify prices are configured for transactions
 * 
 * PRICING MODEL:
 * - effectiveFrom: Date price becomes active
 * - price: Selling price per litre (₹)
 * - costPrice: Cost price per litre (₹)
 * - profit: price - costPrice
 */

// ===== SERVICE LAYER =====
const fuelPricingService = require('../services/fuelPricingService');

// ===== MODEL & DATABASE ACCESS =====
const { FuelPrice, Station, User } = require('../services/modelAccess');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');
const { canAccessStation } = require('../utils/stationAccessControl');
const { FUEL_TYPES } = require('../config/constants');
const { createContextLogger } = require('../services/loggerService');

// ===== LOGGER =====
const logger = createContextLogger('FuelPricingController');

// ============================================
// FUEL PRICES
// ============================================

/**
 * Get current and historical fuel prices for a station
 * GET /api/v1/stations/:stationId/prices
 * 
 * Business logic delegated to FuelPricingService.getFuelPrices().
 * Returns: current prices by fuel type and historical prices.
 */
exports.getFuelPrices = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Delegate to service
    const prices = await fuelPricingService.getFuelPrices(stationId);

    res.json({
      success: true,
      data: prices,
      fuelPrices: prices
    });

  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Set or update fuel price for a station
 * POST /api/v1/stations/:stationId/prices
 * PUT /api/v1/stations/:stationId/prices/:fuelType
 * 
 * Creates new price record (maintains history) or updates existing price for same date.
 * 
 * Request body:
 * {
 *   fuelType: "petrol|diesel",
 *   price: 104.50,              // Selling price per litre
 *   costPrice: 95.20,           // Cost price per litre (optional)
 *   effectiveFrom: "2025-03-22" // Date this price becomes active (default: today)
 * }
 * 
 * Response includes:
 * - fuelPrice data
 * - profit margin calculation if costPrice provided
 * - audit log entry
 */
exports.setFuelPrice = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Delegate to service
    const fuelPrice = await fuelPricingService.setFuelPrice(stationId, req.body, user.id);
    res.status(201).json({ success: true, data: fuelPrice });

  } catch (error) {
    if (error.message.includes('required')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Check if price is set for a fuel type on a specific date
 * GET /api/v1/stations/:stationId/prices/check?fuelType=petrol&date=2025-01-01
 * 
 * Used by frontend to validate before allowing sales entry.
 * Returns active price or null if not configured.
 * 
 * Business logic delegated to FuelPricingService.checkPriceSet().
 */
exports.checkPriceSet = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { fuelType, date } = req.query;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!fuelType) {
      return res.status(400).json({ 
        success: false, 
        error: 'fuelType query parameter is required' 
      });
    }

    const checkDate = date || new Date().toISOString().split('T')[0];

    // Delegate to service
    const priceInfo = await fuelPricingService.checkPriceForDate(stationId, fuelType, checkDate);
    res.json({ success: true, data: priceInfo });

  } catch (error) {
    if (error.message.includes('invalid') || error.message.includes('required')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
};
