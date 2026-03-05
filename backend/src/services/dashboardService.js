/**
 * Dashboard Service
 * Business logic and data aggregation for dashboard analytics
 */

const dashboardRepo = require('../repositories/dashboardRepository');
const paymentService = require('./paymentBreakdownService');
const { FUEL_TYPE_LABELS } = require('../config/constants');
const { Op, fn, col, sequelize } = require('sequelize');

/**
 * Calculate today's dashboard summary
 */
async function calculateDailySummary(stationFilter, userRole) {
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
 * Aggregate nozzle breakdown with proper payment allocation
 */
async function calculateNozzleBreakdown(stationFilter, startDate, endDate, pumpId) {
  const readings = await dashboardRepo.getReadingsWithNozzleInfo(
    stationFilter, 
    startDate, 
    endDate, 
    pumpId
  );

  const { txnCache, txnReadingTotals } = await paymentService.allocatePaymentBreakdownsProportionally(readings);

  const nozzleMap = {};

  readings.forEach(reading => {
    const nozzleId = reading.nozzle.id;
    
    if (!nozzleMap[nozzleId]) {
      nozzleMap[nozzleId] = {
        nozzle: reading.nozzle,
        litres: 0,
        amount: 0,
        cash: 0,
        online: 0,
        credit: 0,
        readings: 0
      };
    }

    const readingAmount = parseFloat(reading.totalAmount || 0);
    nozzleMap[nozzleId].litres += parseFloat(reading.litresSold || 0);
    nozzleMap[nozzleId].amount += readingAmount;
    nozzleMap[nozzleId].readings += 1;

    if (reading.transactionId && txnCache[reading.transactionId]?.paymentBreakdown) {
      const pb = txnCache[reading.transactionId].paymentBreakdown;
      const txnTotal = txnReadingTotals[reading.transactionId] || 1;
      const allocation = paymentService.getProportionalAllocation(readingAmount, pb, txnTotal);
      
      nozzleMap[nozzleId].cash += allocation.cash;
      nozzleMap[nozzleId].online += allocation.online;
      nozzleMap[nozzleId].credit += allocation.credit;
    }
  });

  return Object.values(nozzleMap).map(n => ({
    nozzleId: n.nozzle?.id,
    nozzleNumber: n.nozzle?.nozzleNumber,
    fuelType: n.nozzle?.fuelType,
    fuelLabel: FUEL_TYPE_LABELS[n.nozzle?.fuelType] || n.nozzle?.fuelType,
    pump: { id: n.nozzle?.pump?.id, name: n.nozzle?.pump?.name, number: n.nozzle?.pump?.pumpNumber },
    litres: parseFloat(n.litres.toFixed(2)),
    amount: parseFloat(n.amount.toFixed(2)),
    cash: parseFloat(n.cash.toFixed(2)),
    online: parseFloat(n.online.toFixed(2)),
    credit: parseFloat(n.credit.toFixed(2)),
    readings: n.readings
  }));
}

/**
 * Aggregate fuel type breakdown
 */
async function calculateFuelBreakdown(stationFilter, startDate, endDate) {
  const readings = await dashboardRepo.getFuelTypeReadings(stationFilter, startDate, endDate);
  const { txnCache, txnReadingTotals } = await paymentService.allocatePaymentBreakdownsProportionally(readings);

  const fuelMap = {};

  readings.forEach(reading => {
    const fuelType = reading.fuelType;
    
    if (!fuelMap[fuelType]) {
      fuelMap[fuelType] = {
        litres: 0,
        amount: 0,
        cash: 0,
        online: 0,
        credit: 0
      };
    }

    const readingAmount = parseFloat(reading.totalAmount || 0);
    fuelMap[fuelType].litres += parseFloat(reading.litresSold || 0);
    fuelMap[fuelType].amount += readingAmount;

    if (reading.transactionId && txnCache[reading.transactionId]?.paymentBreakdown) {
      const pb = txnCache[reading.transactionId].paymentBreakdown;
      const txnTotal = txnReadingTotals[reading.transactionId] || 1;
      const allocation = paymentService.getProportionalAllocation(readingAmount, pb, txnTotal);
      
      fuelMap[fuelType].cash += allocation.cash;
      fuelMap[fuelType].online += allocation.online;
      fuelMap[fuelType].credit += allocation.credit;
    }
  });

  return Object.keys(fuelMap).map(fuelType => ({
    fuelType,
    label: FUEL_TYPE_LABELS[fuelType] || fuelType,
    litres: parseFloat(fuelMap[fuelType].litres.toFixed(2)),
    amount: parseFloat(fuelMap[fuelType].amount.toFixed(2)),
    cash: parseFloat(fuelMap[fuelType].cash.toFixed(2)),
    online: parseFloat(fuelMap[fuelType].online.toFixed(2)),
    credit: parseFloat(fuelMap[fuelType].credit.toFixed(2))
  }));
}

/**
 * Format pump performance data
 */
function formatPumpPerformance(readings) {
  const pumpMap = new Map();

  readings.forEach(r => {
    if (!pumpMap.has(r.pump_id)) {
      pumpMap.set(r.pump_id, {
        pumpId: r.pump_id,
        pumpName: r.pump_name,
        pumpNumber: r.pump_number.toString(),
        stationName: r.station_name,
        totalSales: 0,
        totalQuantity: 0,
        transactions: 0,
        nozzles: new Map()
      });
    }
    
    const pump = pumpMap.get(r.pump_id);
    pump.totalSales += parseFloat(r.litres_sold || 0) * parseFloat(r.price_per_litre || 0);
    pump.totalQuantity += parseFloat(r.litres_sold || 0);
    pump.transactions += 1;

    if (!pump.nozzles.has(r.nozzle_id)) {
      pump.nozzles.set(r.nozzle_id, {
        nozzleId: r.nozzle_id,
        nozzleNumber: r.nozzle_number.toString(),
        fuelType: r.fuel_type,
        sales: 0,
        quantity: 0
      });
    }
    
    const nozzle = pump.nozzles.get(r.nozzle_id);
    nozzle.sales += parseFloat(r.litres_sold || 0) * parseFloat(r.price_per_litre || 0);
    nozzle.quantity += parseFloat(r.litres_sold || 0);
  });

  return Array.from(pumpMap.values()).map(pump => ({
    pumpId: pump.pumpId,
    pumpName: pump.pumpName,
    pumpNumber: pump.pumpNumber,
    stationName: pump.stationName,
    totalSales: Math.round(pump.totalSales * 100) / 100,
    totalQuantity: Math.round(pump.totalQuantity * 100) / 100,
    transactions: pump.transactions,
    nozzles: Array.from(pump.nozzles.values())
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
  calculateNozzleBreakdown,
  calculateFuelBreakdown,
  formatPumpPerformance,
  calculateGrowth,
  getAgeingBucket
};
