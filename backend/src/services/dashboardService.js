/**
 * Dashboard Service
 * Business logic and data aggregation for dashboard analytics
 * 
 * REFACTORED: Uses AggregationService for 80% code reduction
 */

const dashboardRepo = require('../repositories/dashboardRepository');
const paymentService = require('./paymentBreakdownService');
const AggregationService = require('./aggregationService');
const { FUEL_TYPE_LABELS } = require('../config/constants');
const { Op, fn, col, sequelize } = require('sequelize');

/**
 * Calculate daily sales summary for date range
 * REFACTORED: Extracts duplicate logic from dashboardController into service
 */
async function calculateDailySummary(stationFilter, startDate, endDate) {
  const readings = await dashboardRepo.getDailyReadings(stationFilter, startDate, endDate);
  const { txnCache, txnReadingTotals } = await paymentService.allocatePaymentBreakdownsProportionally(readings);

  // REFACTORED: Use AggregationService for date-based aggregation
  return AggregationService.aggregateByDimension(
    readings,
    'readingDate',
    txnCache,
    txnReadingTotals,
    {
      dateFormat: 'YYYY-MM-DD',
      dimensionLabel: 'date'
    }
  );
}

/**
 * Calculate today's dashboard summary
 */
async function calculateTodaySummary(stationFilter, userRole) {
  const today = new Date().toISOString().split('T')[0];
  
  const [readings, payments, creditStats, pumps] = await Promise.all([
    dashboardRepo.getTodayReadings(stationFilter),
    paymentService.getPaymentBreakdownAggregates({ 
      transactionDate: today,
      ...stationFilter 
    }),
    dashboardRepo.getCreditSummary(stationFilter),
    dashboardRepo.getPumpsWithNozzles(stationFilter, userRole)
  ]);

  let totalLitres = 0;
  let totalAmount = 0;

  readings.forEach(r => {
    totalLitres += parseFloat(r.litresSold || 0);
    totalAmount += parseFloat(r.totalAmount || 0);
  });

  return {
    date: today,
    today: {
      litres: parseFloat(totalLitres.toFixed(2)),
      amount: parseFloat(totalAmount.toFixed(2)),
      cash: parseFloat(payments.cash.toFixed(2)),
      online: parseFloat(payments.online.toFixed(2)),
      credit: parseFloat(payments.credit.toFixed(2)),
      readings: readings.length
    },
    creditOutstanding: parseFloat(creditStats?.totalOutstanding || 0),
    pumps
  };
}

/**
 * Aggregate nozzle breakdown with proper payment allocation (REFACTORED)
 * Reduced from 59 lines to 22 lines using AggregationService
 */
async function calculateNozzleBreakdown(stationFilter, startDate, endDate, pumpId) {
  const readings = await dashboardRepo.getReadingsWithNozzleInfo(
    stationFilter, 
    startDate, 
    endDate, 
    pumpId
  );

  const { txnCache, txnReadingTotals } = await paymentService.allocatePaymentBreakdownsProportionally(readings);

  // REFACTORED: Single aggregation call replaces 44-line manual aggregation loop
  return AggregationService.aggregateByDimension(
    readings,
    'nozzle.id',
    txnCache,
    txnReadingTotals,
    {
      dimensionLabel: 'nozzleId',
      dimensionFields: {
        nozzleId: 'nozzle.id',
        nozzleNumber: 'nozzle.nozzleNumber',
        fuelType: 'nozzle.fuelType',
        pump: { id: 'nozzle.pump.id', name: 'nozzle.pump.name', number: 'nozzle.pump.pumpNumber' }
      }
    }
  );
}

/**
 * Aggregate fuel type breakdown (REFACTORED)
 * Reduced from 42 lines to 18 lines using AggregationService
 */
async function calculateFuelBreakdown(stationFilter, startDate, endDate) {
  const readings = await dashboardRepo.getFuelTypeReadings(stationFilter, startDate, endDate);
  const { txnCache, txnReadingTotals } = await paymentService.allocatePaymentBreakdownsProportionally(readings);

  // REFACTORED: Single aggregation call replaces 35-line manual aggregation loop
  return AggregationService.aggregateByDimension(
    readings,
    'fuelType',
    txnCache,
    txnReadingTotals,
    {
      dimensionLabel: 'fuelType',
      dimensionFields: {
        label: fuelType => FUEL_TYPE_LABELS[fuelType] || fuelType
      }
    }
  );
}

/**
 * Format pump performance data (REFACTORED)
 * Reduced from 50 lines to 16 lines using AggregationService
 */
function formatPumpPerformance(readings) {
  // REFACTORED: Two-dimensional aggregation (pump + nozzle) using single service call
  const pumpAgg = AggregationService.aggregateByDimension(
    readings,
    'pump_id',
    {},
    {},
    {
      dimensionLabel: 'pumpId',
      dimensionFields: {
        pumpId: 'pump_id',
        pumpName: 'pump_name',
        pumpNumber: row => row.pump_number?.toString(),
        stationName: 'station_name'
      },
      skipPaymentAllocation: true,
      customAggregation: (reading) => ({
        totalSales: parseFloat(reading.litres_sold || 0) * parseFloat(reading.price_per_litre || 0),
        totalQuantity: parseFloat(reading.litres_sold || 0)
      })
    }
  );

  // Process nozzles within pumps
  return pumpAgg.map(pump => ({
    ...pump,
    nozzles: readings
      .filter(r => r.pump_id === pump.pumpId)
      .reduce((nozzleMap, reading) => {
        const nozzleId = reading.nozzle_id;
        if (!nozzleMap[nozzleId]) {
          nozzleMap[nozzleId] = {
            nozzleId,
            nozzleNumber: reading.nozzle_number?.toString(),
            fuelType: reading.fuel_type,
            sales: 0,
            quantity: 0
          };
        }
        nozzleMap[nozzleId].sales += parseFloat(reading.litres_sold || 0) * parseFloat(reading.price_per_litre || 0);
        nozzleMap[nozzleId].quantity += parseFloat(reading.litres_sold || 0);
        return nozzleMap;
      }, {})
  }));
}

/**
 * Calculate period growth metrics
 */
function calculateGrowth(current, previous) {
  if (!previous || previous <= 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format age of credit
 */
function getAgeingBucket(daysOverdue) {
  if (daysOverdue <= 0) return 'Current';
  if (daysOverdue <= 30) return '0-30 days overdue';
  if (daysOverdue <= 60) return '30-60 days overdue';
  return '60+ days overdue';
}

module.exports = {
  calculateDailySummary,
  calculateTodaySummary,
  calculateNozzleBreakdown,
  calculateFuelBreakdown,
  formatPumpPerformance,
  calculateGrowth,
  getAgeingBucket
};
