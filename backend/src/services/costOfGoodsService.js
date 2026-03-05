/**
 * Tank Refill & Cost of Goods Service (Issue #9 fix)
 * 
 * Links tank refills to cost of goods calculations
 * Auto-calculates COGS from actual tank purchases
 */

const { Tank, TankRefill, CostOfGoods, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Calculate COGS for a station and month from tank refills
 */
exports.calculateCOGSFromRefills = async (stationId, year, month) => {
  try {
    // Build date range for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Get all tank refills for the month
    const refills = await TankRefill.findAll({
      where: {
        stationId,
        refillDate: {
          [Op.gte]: startDate,
          [Op.lte]: endDate
        }
      },
      attributes: ['id', 'fuelType', 'quantityRefilled', 'pricePerUnit', 'totalCost'],
      raw: true
    });

    if (refills.length === 0) {
      return {
        period: `${year}-${String(month).padStart(2, '0')}`,
        cogsByFuelType: {},
        totalCOGS: 0,
        refillCount: 0,
        message: 'No tank refills found for this period'
      };
    }

    // Group by fuel type and sum
    const cogsByFuelType = {};
    const refillsByFuelType = {};

    refills.forEach(r => {
      if (!cogsByFuelType[r.fuelType]) {
        cogsByFuelType[r.fuelType] = 0;
        refillsByFuelType[r.fuelType] = [];
      }
      cogsByFuelType[r.fuelType] += parseFloat(r.totalCost);
      refillsByFuelType[r.fuelType].push(r);
    });

    const totalCOGS = Object.values(cogsByFuelType).reduce((sum, cost) => sum + cost, 0);

    return {
      period: `${year}-${String(month).padStart(2, '0')}`,
      cogsByFuelType,
      totalCOGS: parseFloat(totalCOGS.toFixed(2)),
      refillCount: refills.length,
      refillsByFuelType
    };
  } catch (err) {
    console.error('[calculateCOGSFromRefills] Error:', err);
    throw err;
  }
};

/**
 * Reconcile COGS: Auto-calculate from refills and compare with manual entry
 */
exports.reconcileCOGS = async (stationId, year, month) => {
  try {
    // Get calculated COGS
    const calculated = await this.calculateCOGSFromRefills(stationId, year, month);

    // Check if CostOfGoods record exists
    const existing = await CostOfGoods.findOne({
      where: {
        stationId,
        year,
        month
      }
    });

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    if (!existing) {
      // Create new COGS record with calculated values
      const newCOGS = await CostOfGoods.create({
        stationId,
        year,
        month,
        calculatedCostAmount: calculated.totalCOGS,
        costSource: 'calculated',
        tankRefillIds: calculated.refillsByFuelType ? 
          Object.values(calculated.refillsByFuelType)
            .flat()
            .map(r => r.id) : 
          []
      });

      return {
        action: 'created',
        cogs: newCOGS,
        reconciliation: {
          calculatedCOGS: calculated.totalCOGS,
          refillCount: calculated.refillCount,
          message: `COGS record created from ${calculated.refillCount} refills`
        }
      };
    }

    // Compare calculated vs recorded
    const variance = Math.abs(
      (existing.calculatedCostAmount || 0) - calculated.totalCOGS
    );

    // If variance is significant (>2%), flag for review
    const percentVariance = (variance / calculated.totalCOGS) * 100;
    const requiresReview = percentVariance > 2;

    if (requiresReview) {
      // Update record with variance flag
      existing.calculatedCostAmount = calculated.totalCOGS;
      existing.varianceAmount = variance;
      existing.variancePercent = percentVariance;
      existing.varianceNote = `${percentVariance.toFixed(2)}% difference from manual entry`;
      await existing.save();

      return {
        action: 'flagged',
        cogs: existing,
        reconciliation: {
          recordedCOGS: existing.manualCostAmount || 0,
          calculatedCOGS: calculated.totalCOGS,
          variance: parseFloat(variance.toFixed(2)),
          variancePercent: parseFloat(percentVariance.toFixed(2)),
          refillCount: calculated.refillCount,
          requiresReview: true,
          message: `Variance flagged: Manual ₹${existing.manualCostAmount} vs Calculated ₹${calculated.totalCOGS}`
        }
      };
    }

    return {
      action: 'reconciled',
      cogs: existing,
      reconciliation: {
        recordedCOGS: existing.manualCostAmount || 0,
        calculatedCOGS: calculated.totalCOGS,
        variance: parseFloat(variance.toFixed(2)),
        refillCount: calculated.refillCount,
        message: `COGS reconciled: amounts match`
      }
    };
  } catch (err) {
    console.error('[reconcileCOGS] Error:', err);
    throw err;
  }
};

/**
 * Update COGS when tank refill is added
 */
exports.updateCOGSOnRefill = async (refill) => {
  try {
    const refillDate = new Date(refill.refillDate);
    const year = refillDate.getFullYear();
    const month = refillDate.getMonth() + 1;

    // Recalculate COGS for the month
    const reconciliation = await this.reconcileCOGS(refill.stationId, year, month);

    return reconciliation;
  } catch (err) {
    console.error('[updateCOGSOnRefill] Error:', err);
    // Don't throw - COGS update should not block refill creation
  }
};

/**
 * Get COGS details for a period
 */
exports.getCOGSDetails = async (stationId, startDate, endDate) => {
  try {
    const costRecords = await CostOfGoods.findAll({
      where: {
        stationId,
        date: {
          [Op.gte]: startDate,
          [Op.lte]: endDate
        }
      }
    });

    const totalCOGS = costRecords.reduce(
      (sum, r) => sum + parseFloat(r.finalCostAmount || 0),
      0
    );

    return {
      period: {
        startDate,
        endDate
      },
      records: costRecords,
      totalCOGS: parseFloat(totalCOGS.toFixed(2)),
      recordCount: costRecords.length
    };
  } catch (err) {
    console.error('[getCOGSDetails] Error:', err);
    throw err;
  }
};

/**
 * Validate COGS calculation
 */
exports.validateCOGSCalculation = (recordedCOGS, calculatedCOGS, tolerance = 0.02) => {
  const recorded = parseFloat(recordedCOGS);
  const calculated = parseFloat(calculatedCOGS);
  const variance = Math.abs(recorded - calculated);
  const percentVariance = (variance / calculated) * 100;

  if (percentVariance > tolerance * 100) {
    return {
      isValid: false,
      recorded,
      calculated,
      variance,
      percentVariance: parseFloat(percentVariance.toFixed(2)),
      message: `COGS mismatch: ${percentVariance.toFixed(2)}% difference`,
      requiresApproval: true
    };
  }

  return {
    isValid: true,
    recorded,
    calculated,
    variance,
    percentVariance: parseFloat(percentVariance.toFixed(2)),
    message: 'COGS calculation verified'
  };
};
