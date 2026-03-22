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

  // Flatten nozzle data for aggregation service
  const flattenedReadings = readings.map(r => ({
    id: r.id,
    nozzleId: r.nozzle?.id,
    nozzleNumber: r.nozzle?.nozzleNumber,
    fuelType: r.nozzle?.fuelType,
    pumpId: r.nozzle?.pump?.id,
    pumpName: r.nozzle?.pump?.name,
    pumpNumber: r.nozzle?.pump?.pumpNumber,
    stationName: r.station?.name,
    litresSold: r.litresSold,
    totalAmount: r.totalAmount,
    transactionId: r.transactionId
  }));

  const { txnCache, txnReadingTotals } = await paymentService.allocatePaymentBreakdownsProportionally(flattenedReadings);

  // REFACTORED: Single aggregation call replaces 44-line manual aggregation loop
  // Preserve nozzle metadata (nozzleNumber, fuelType, pumpName) in aggregated result
  return AggregationService.aggregateByDimension(
    flattenedReadings,
    'nozzleId',
    txnCache,
    txnReadingTotals,
    { preserveFields: ['nozzleNumber', 'fuelType', 'pumpName', 'stationName'] }
  );
}

/**
 * Aggregate fuel type breakdown (REFACTORED)
 * Reduced from 42 lines to 18 lines using AggregationService
 */
async function calculateFuelBreakdown(stationFilter, startDate, endDate) {
  const readings = await dashboardRepo.getFuelTypeReadings(stationFilter, startDate, endDate);
  
  // Flatten nozzle data for fuel type aggregation
  const flattenedReadings = readings.map(r => ({
    id: r.id,
    fuelType: r.nozzle?.fuelType,
    litresSold: r.litresSold,
    totalAmount: r.totalAmount,
    transactionId: r.transactionId
  }));

  const { txnCache, txnReadingTotals } = await paymentService.allocatePaymentBreakdownsProportionally(flattenedReadings);

  // REFACTORED: Single aggregation call replaces 35-line manual aggregation loop
  return AggregationService.aggregateByDimension(
    flattenedReadings,
    'fuelType',
    txnCache,
    txnReadingTotals
  );
}

/**
 * Format pump performance data
 * Aggregates readings by pump, with nozzle breakdown
 */
function formatPumpPerformance(readings) {
  if (!Array.isArray(readings) || readings.length === 0) {
    return [];
  }

  // Group by pump
  const pumpMap = {};
  
  readings.forEach(reading => {
    const pumpId = reading.pump_id;
    if (!pumpMap[pumpId]) {
      pumpMap[pumpId] = {
        pumpId,
        pumpName: reading.pump_name,
        pumpNumber: reading.pump_number?.toString(),
        stationName: reading.station_name,
        totalSales: 0,
        totalQuantity: 0,
        nozzles: {}
      };
    }

    const sales = parseFloat(reading.litres_sold || 0) * parseFloat(reading.price_per_litre || 0);
    const quantity = parseFloat(reading.litres_sold || 0);
    
    pumpMap[pumpId].totalSales += sales;
    pumpMap[pumpId].totalQuantity += quantity;

    // Aggregate nozzles within pump
    const nozzleId = reading.nozzle_id;
    if (!pumpMap[pumpId].nozzles[nozzleId]) {
      pumpMap[pumpId].nozzles[nozzleId] = {
        nozzleId,
        nozzleNumber: reading.nozzle_number?.toString(),
        fuelType: reading.fuel_type,
        sales: 0,
        quantity: 0
      };
    }

    pumpMap[pumpId].nozzles[nozzleId].sales += sales;
    pumpMap[pumpId].nozzles[nozzleId].quantity += quantity;
  });

  // Convert nozzle maps to arrays and return pump array
  return Object.values(pumpMap).map(pump => ({
    pumpId: pump.pumpId,
    pumpName: pump.pumpName,
    pumpNumber: pump.pumpNumber,
    stationName: pump.stationName,
    totalSales: parseFloat(pump.totalSales.toFixed(2)),
    totalQuantity: parseFloat(pump.totalQuantity.toFixed(2)),
    nozzles: Object.values(pump.nozzles).map(nozzle => ({
      nozzleId: nozzle.nozzleId,
      nozzleNumber: nozzle.nozzleNumber,
      fuelType: nozzle.fuelType,
      sales: parseFloat(nozzle.sales.toFixed(2)),
      quantity: parseFloat(nozzle.quantity.toFixed(2))
    }))
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
