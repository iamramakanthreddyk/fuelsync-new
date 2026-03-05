/**
 * Employee Sales Breakdown Service
 * 
 * Aggregates employee sales by fuel type and payment method
 * Provides comprehensive breakdown of who sold what and how it was paid
 */

const { sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Get employee sales breakdown for a date range
 * Groups by employee, then by fuel type
 * Includes payment method split
 */
async function getEmployeeSalesBreakdown({ stationId, startDate, endDate }) {
  const { NozzleReading, Nozzle, User, DailyTransaction } = require('../models');

  try {
    // Ensure dates are properly formatted
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const formattedStartDate = start.toISOString().split('T')[0];
    const formattedEndDate = end.toISOString().split('T')[0];
    
    console.log(`[EmployeeSalesService] Querying readings: station=${stationId}, dates=${formattedStartDate} to ${formattedEndDate}`);
    
    // Diagnostic: Check raw database state
    const rawCount = await sequelize.query(
      `SELECT COUNT(*) as count FROM nozzle_readings WHERE station_id = ? AND reading_date BETWEEN ? AND ?`,
      { replacements: [stationId, formattedStartDate, formattedEndDate], type: sequelize.QueryTypes.SELECT }
    );
    const readingCount = rawCount[0]?.count || 0;
    console.log(`[EmployeeSalesService] Raw DB query found ${readingCount} readings`);
    
    if (readingCount === 0) {
      console.log(`[EmployeeSalesService] No readings found. Checking raw counts...`);
      // Diagnostic: Check if there's ANY data for this station
      const anyCount = await sequelize.query(
        `SELECT COUNT(*) as count FROM nozzle_readings WHERE station_id = ?`,
        { replacements: [stationId], type: sequelize.QueryTypes.SELECT }
      );
      console.log(`[EmployeeSalesService] Total readings for station ${stationId}: ${anyCount[0]?.count || 0}`);
    }
    
    // Query all readings for the date range
    const readings = await NozzleReading.findAll({
      where: {
        stationId,
        readingDate: {
          [Op.between]: [formattedStartDate, formattedEndDate]
        }
      },
      include: [
        {
          model: Nozzle,
          as: 'nozzle',
          attributes: ['id', 'pumpId', 'fuelType'],
          required: false  // Allow readings without nozzle reference
        },
        {
          model: User,
          as: 'enteredByUser',
          attributes: ['id', 'name', 'email']
        }
      ],
      attributes: [
        'id',
        'stationId',
        'nozzleId',
        'enteredBy',
        'readingDate',
        'litresSold',
        'totalAmount',
        'paymentBreakdown',
        'cashAmount',
        'onlineAmount',
        'creditAmount'
      ],
      raw: false
    });

    console.log(`[EmployeeSalesService] Found ${readings.length} readings for station ${stationId}`);

    // Fetch daily transactions to get accurate payment breakdown
    const transactions = await DailyTransaction.findAll({
      where: {
        stationId,
        transactionDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: ['id', 'transactionDate', 'totalSaleValue', 'paymentBreakdown', 'readingIds', 'createdBy'],
      raw: true
    });

    // Build a map of reading IDs to transaction payment breakdowns
    const readingToTransaction = new Map();
    transactions.forEach(txn => {
      if (txn.readingIds && Array.isArray(txn.readingIds)) {
        txn.readingIds.forEach(readingId => {
          readingToTransaction.set(readingId, txn.paymentBreakdown);
        });
      }
    });

    // Aggregate by employee, then by fuel type
    const employeeMap = new Map();

    console.log(`[EmployeeSalesService] Starting aggregation of ${readings.length} readings...`);
    
    readings.forEach((reading, idx) => {
      const employeeId = reading.enteredBy;
      const employeeName = reading.enteredByUser?.name || 'Unknown';
      const fuelType = reading.nozzle?.fuelType || 'Unknown';
      const litres = parseFloat(reading.litresSold) || 0;
      const saleValue = parseFloat(reading.totalAmount) || 0;

      if (idx < 3) {
        console.log(`[EmployeeSalesService] Reading ${idx}: employee=${employeeName}, fuel=${fuelType}, litres=${litres}, value=${saleValue}`);
      }

      // Get payment breakdown from transaction or reading
      let paymentBreakdown = { cash: 0, online: 0, credit: 0 };
      
      if (readingToTransaction.has(reading.id)) {
        paymentBreakdown = readingToTransaction.get(reading.id);
      } else if (reading.paymentBreakdown && typeof reading.paymentBreakdown === 'object') {
        paymentBreakdown = reading.paymentBreakdown;
      } else {
        // Legacy: use individual fields or estimate
        paymentBreakdown.cash = parseFloat(reading.cashAmount) || 0;
        paymentBreakdown.online = parseFloat(reading.onlineAmount) || 0;
        paymentBreakdown.credit = parseFloat(reading.creditAmount) || 0;
      }

      // Initialize employee entry if doesn't exist
      if (!employeeMap.has(employeeId)) {
        employeeMap.set(employeeId, {
          employeeId,
          employeeName,
          totalSales: 0,
          totalQuantity: 0,
          totalCash: 0,
          totalOnline: 0,
          totalCredit: 0,
          totalTransactions: 0,
          byFuelType: new Map(),
          lastActivityDate: null
        });
      }

      const employee = employeeMap.get(employeeId);
      employee.totalSales += saleValue;
      employee.totalQuantity += litres;
      employee.totalCash += parseFloat(paymentBreakdown.cash) || 0;
      employee.totalOnline += parseFloat(paymentBreakdown.online) || 0;
      employee.totalCredit += parseFloat(paymentBreakdown.credit) || 0;
      employee.totalTransactions += 1;
      
      // Update last activity date
      if (!employee.lastActivityDate || reading.readingDate > employee.lastActivityDate) {
        employee.lastActivityDate = reading.readingDate;
      }

      // Aggregate by fuel type
      if (!employee.byFuelType.has(fuelType)) {
        employee.byFuelType.set(fuelType, {
          fuelType,
          quantity: 0,
          saleValue: 0,
          cashAmount: 0,
          onlineAmount: 0,
          creditAmount: 0,
          transactionCount: 0
        });
      }

      const fuelData = employee.byFuelType.get(fuelType);
      fuelData.quantity += litres;
      fuelData.saleValue += saleValue;
      fuelData.cashAmount += parseFloat(paymentBreakdown.cash) || 0;
      fuelData.onlineAmount += parseFloat(paymentBreakdown.online) || 0;
      fuelData.creditAmount += parseFloat(paymentBreakdown.credit) || 0;
      fuelData.transactionCount += 1;
    });

    // Convert to array and format
    const result = Array.from(employeeMap.values()).map(emp => {
      // Calculate average transaction value
      const avgTxn = emp.totalTransactions > 0 
        ? emp.totalSales / emp.totalTransactions 
        : 0;

      // Convert fuel type map to array and calculate metrics
      const byFuelType = Array.from(emp.byFuelType.values()).map(fuel => ({
        fuelType: fuel.fuelType,
        quantity: parseFloat(fuel.quantity.toFixed(3)),
        saleValue: parseFloat(fuel.saleValue.toFixed(2)),
        cashAmount: parseFloat(fuel.cashAmount.toFixed(2)),
        onlineAmount: parseFloat(fuel.onlineAmount.toFixed(2)),
        creditAmount: parseFloat(fuel.creditAmount.toFixed(2)),
        transactionCount: fuel.transactionCount,
        averageTransactionValue: fuel.transactionCount > 0 
          ? parseFloat((fuel.saleValue / fuel.transactionCount).toFixed(2))
          : 0
      }));

      return {
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        totalSales: parseFloat(emp.totalSales.toFixed(2)),
        totalQuantity: parseFloat(emp.totalQuantity.toFixed(3)),
        totalCash: parseFloat(emp.totalCash.toFixed(2)),
        totalOnline: parseFloat(emp.totalOnline.toFixed(2)),
        totalCredit: parseFloat(emp.totalCredit.toFixed(2)),
        totalTransactions: emp.totalTransactions,
        averageTransaction: parseFloat(avgTxn.toFixed(2)),
        byFuelType: byFuelType.sort((a, b) => b.saleValue - a.saleValue),
        lastActivityDate: emp.lastActivityDate
      };
    });

    // Sort by total sales descending
    result.sort((a, b) => b.totalSales - a.totalSales);

    console.log(`[EmployeeSalesService] Returning ${result.length} employee records for station ${stationId}`);
    return result;
  } catch (error) {
    console.error('[EmployeeSalesService] Error:', error);
    throw error;
  }
}

module.exports = {
  getEmployeeSalesBreakdown
};
