/**
 * Profit & Loss Tracking Controller
 * Calculates detailed P&L for owner dashboard
 * OWNER ONLY ACCESS
 */

// ===== MODELS & DATABASE =====
const { 
  NozzleReading, 
  FuelPrice, 
  Expense, 
  Station,
  Settlement
} = require('../models');
const { Op, fn, col } = require('sequelize');

// ===== ERROR & RESPONSE HANDLING =====
const { asyncHandler, NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// ===== UTILITIES =====
const { logAudit } = require('../utils/auditLog');

/**
 * Get profit summary for a month
 * GET /api/v1/stations/:stationId/profit-summary?month=2025-01
 * Access: Owner only
 */
exports.getProfitSummary = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { month } = req.query;
  
  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) throw new NotFoundError('Station', stationId);

  // Default to current month
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  
  // Parse month to get date range
  const [year, monthNum] = targetMonth.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0);
  
  // Get all readings for the month
  const readings = await NozzleReading.findAll({
    where: {
      stationId,
      readingDate: {
        [Op.between]: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
      }
    },
    attributes: [
      'id',
      'litresSold',
      'pricePerLitre',
      'fuelType',
      'readingDate'
    ]
  });
  
  // Calculate revenue and cost of goods
  let totalRevenue = 0;
  let totalCostOfGoods = 0;
  let totalLitres = 0;
  let totalLitresWithCost = 0;  // Only litres with cost price data
  let readingsWithCostPrice = 0;  // Track how many readings have cost price
  let totalReadingsCount = readings.length;
  let revenueByFuelType = {};
  let profitByFuelType = {};
  let readingsDetailsByFuelType = {};  // Detailed breakdown of readings
  
  // Get fuel prices for the period to calculate COGS
  for (const reading of readings) {
    const litres = parseFloat(reading.litresSold || 0);
    const sellingPrice = parseFloat(reading.pricePerLitre || 0);
    const fuelType = reading.fuelType;
    
    // Get price data for this reading date
    const priceData = await FuelPrice.findOne({
      where: {
        stationId,
        fuelType,
        effectiveFrom: {
          [Op.lte]: reading.readingDate
        }
      },
      order: [['effectiveFrom', 'DESC']]
    });
    
    // Track by fuel type
    if (!revenueByFuelType[fuelType]) {
      revenueByFuelType[fuelType] = {
        revenue: 0,
        costOfGoods: 0,
        litres: 0,
        revenueWithCost: 0,
        litresWithCost: 0,
        readingsWithCost: 0,
        totalReadings: 0
      };
      readingsDetailsByFuelType[fuelType] = {
        withCostPrice: [],
        withoutCostPrice: []
      };
    }
    
    // ONLY if cost price is available - include in profit calculations
    if (priceData?.costPrice) {
      const costPrice = parseFloat(priceData.costPrice);
      const revenue = litres * sellingPrice;
      const costOfGoods = litres * costPrice;
      
      // Add to totals for PROFITABLE calculations
      totalRevenue += revenue;
      totalCostOfGoods += costOfGoods;
      totalLitres += litres;
      totalLitresWithCost += litres;
      readingsWithCostPrice++;  // Count readings with cost price
      
      // Add to fuel type totals
      revenueByFuelType[fuelType].revenue += revenue;
      revenueByFuelType[fuelType].costOfGoods += costOfGoods;
      revenueByFuelType[fuelType].litres += litres;
      revenueByFuelType[fuelType].revenueWithCost += revenue;
      revenueByFuelType[fuelType].litresWithCost += litres;
      revenueByFuelType[fuelType].readingsWithCost += 1;
      
      // Add to detailed readings WITH cost price
      readingsDetailsByFuelType[fuelType].withCostPrice.push({
        date: reading.readingDate,
        litres: parseFloat(litres.toFixed(2)),
        salePrice: parseFloat(sellingPrice.toFixed(2)),
        costPrice: parseFloat(costPrice.toFixed(2)),
        revenue: parseFloat(revenue.toFixed(2)),
        cogs: parseFloat(costOfGoods.toFixed(2)),
        profit: parseFloat((revenue - costOfGoods).toFixed(2))
      });
    } else {
      // WITHOUT cost price - only track for reporting, don't include in calculations
      const revenue = litres * sellingPrice;
      revenueByFuelType[fuelType].totalReadings += 1;
      
      // Add to detailed readings WITHOUT cost price
      readingsDetailsByFuelType[fuelType].withoutCostPrice.push({
        date: reading.readingDate,
        litres: parseFloat(litres.toFixed(2)),
        salePrice: parseFloat(sellingPrice.toFixed(2)),
        revenue: parseFloat(revenue.toFixed(2)),
        note: 'No cost price set - excluded from profit calculations'
      });
    }
  }
  
  // Calculate profit by fuel type
  Object.keys(revenueByFuelType).forEach(fuelType => {
    const data = revenueByFuelType[fuelType];
    // Only calculate profit margin if there's actual cost data for this fuel type
    const hasCostData = data.readingsWithCost > 0;
    
    profitByFuelType[fuelType] = {
      revenue: parseFloat(data.revenue.toFixed(2)),
      costOfGoods: parseFloat(data.costOfGoods.toFixed(2)),
      litres: parseFloat(data.litres.toFixed(3)),
      profitPerLitre: hasCostData && data.litres > 0 
        ? parseFloat(((data.revenue - data.costOfGoods) / data.litres).toFixed(2))
        : null,  // null if no cost data
      profitMargin: hasCostData && data.revenue > 0
        ? parseFloat(((data.revenue - data.costOfGoods) / data.revenue * 100).toFixed(2))
        : null,  // null if no cost data
      hasCompleteData: hasCostData  // flag to indicate if calculation is valid
    };
  });
  
  // Human-readable labels for expense categories
  const EXPENSE_LABELS = {
    salary: 'Salary',
    electricity: 'Electricity',
    rent: 'Rent / Lease',
    insurance: 'Insurance',
    loan_emi: 'Loan EMI',
    cleaning: 'Cleaning',
    generator_fuel: 'Generator Fuel',
    drinking_water: 'Drinking Water',
    maintenance: 'Maintenance / Repair',
    equipment_purchase: 'Equipment Purchase',
    taxes: 'Taxes & Govt Fees',
    transportation: 'Transportation',
    supplies: 'Supplies',
    miscellaneous: 'Miscellaneous',
  };

  // Only count approved/auto-approved expenses in the P&L — pending ones are excluded
  const APPROVED_STATUSES = ['approved', 'auto_approved'];

  const [expensesResult, pendingExpensesResult, expensesByCategory, shortfallResult] = await Promise.all([
    Expense.sum('amount', {
      where: {
        stationId,
        expenseMonth: targetMonth,
        approvalStatus: { [Op.in]: APPROVED_STATUSES }
      }
    }),
    Expense.sum('amount', {
      where: {
        stationId,
        expenseMonth: targetMonth,
        approvalStatus: 'pending'
      }
    }),
    Expense.findAll({
      attributes: [
        'category',
        [fn('SUM', col('amount')), 'total']
      ],
      where: {
        stationId,
        expenseMonth: targetMonth,
        approvalStatus: { [Op.in]: APPROVED_STATUSES }
      },
      group: ['category'],
      raw: true
    }),
    // Fetch total shortfall (positive variance) for the month from settlements
    Settlement.sum('variance', {
      where: {
        stationId,
        date: {
          [Op.gte]: new Date(`${targetMonth}-01`),
          [Op.lte]: new Date(new Date(`${targetMonth}-01`).getFullYear(), new Date(`${targetMonth}-01`).getMonth() + 1, 0)
        }
      }
    })
  ]);
  
  const totalExpenses = parseFloat((expensesResult || 0).toFixed(2));
  const pendingExpenses = parseFloat((pendingExpensesResult || 0).toFixed(2));
  const totalShortfall = parseFloat(Math.max(0, shortfallResult || 0).toFixed(2)); // Only count positive (loss) variances
  
  // Calculate profits
  const grossProfit = totalRevenue - totalCostOfGoods;
  const netProfit = grossProfit - totalShortfall - totalExpenses;
  const profitMargin = totalRevenue > 0 
    ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(2))
    : 0;
  const profitPerLitre = totalLitres > 0
    ? parseFloat((netProfit / totalLitres).toFixed(2))
    : 0;
  
  // Log view
  await logAudit({
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    stationId,
    action: 'READ',
    entityType: 'ProfitSummary',
    entityId: stationId,
    category: 'analytics',
    severity: 'info',
    description: `Viewed profit summary for ${targetMonth}`
  });
  
  return sendSuccess(res, {
    month: targetMonth,
    summary: {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCostOfGoods: parseFloat(totalCostOfGoods.toFixed(2)),
      totalShortfall: totalShortfall,
      totalExpenses,
      pendingExpenses,
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      profitMargin,
      totalLitres: parseFloat(totalLitres.toFixed(3)),
      profitPerLitre
    },
    breakdown: {
      byFuelType: profitByFuelType,
      byExpenseCategory: expensesByCategory.map(item => ({
        category: item.category,
        label: EXPENSE_LABELS[item.category] || item.category,
        amount: parseFloat(item.total || 0)
      })),
      readingDetails: readingsDetailsByFuelType
    },
    dataCompleteness: {
      totalReadings: totalReadingsCount,
      readingsUsedForCalculation: readingsWithCostPrice,
      readingsExcluded: totalReadingsCount - readingsWithCostPrice,
      completenessPercentage: totalReadingsCount > 0 
        ? parseFloat(((readingsWithCostPrice / totalReadingsCount) * 100).toFixed(2))
        : 0,
      note: readingsWithCostPrice < totalReadingsCount 
        ? `IMPORTANT: Profit calculated from ${readingsWithCostPrice}/${totalReadingsCount} readings only. ${totalReadingsCount - readingsWithCostPrice} readings excluded (missing cost price). Only sales with BOTH cost and sale price data are included in profit calculations.`
        : 'All readings have cost price data - profit calculations are 100% accurate'
    }
  });
});

/**
 * Get daily profit summary
 * GET /api/v1/stations/:stationId/profit-daily?date=2025-01-25
 * Access: Owner only
 */
exports.getDailyProfit = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { date } = req.query;
  
  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) throw new NotFoundError('Station', stationId);

  const queryDate = date || new Date().toISOString().split('T')[0];
  
  // Get all readings for the day
  const readings = await NozzleReading.findAll({
    where: {
      stationId,
      readingDate: queryDate
    },
    attributes: [
      'id',
      'litresSold',
      'pricePerLitre',
      'fuelType'
    ]
  });
  
  // Calculate
  let totalRevenue = 0;
  let totalCostOfGoods = 0;
  let totalLitres = 0;
  let readingsWithCostPrice = 0;
  let byFuelType = {};
  
  for (const reading of readings) {
    const litres = parseFloat(reading.litresSold || 0);
    const revenue = litres * parseFloat(reading.pricePerLitre || 0);
    totalRevenue += revenue;
    totalLitres += litres;
    
    // Get price for COGS calculation
    const priceData = await FuelPrice.findOne({
      where: {
        stationId,
        fuelType: reading.fuelType,
        effectiveFrom: {
          [Op.lte]: queryDate
        }
      },
      order: [['effectiveFrom', 'DESC']]
    });
    
    let costOfGoods = 0;
    if (priceData?.costPrice) {
      costOfGoods = litres * parseFloat(priceData.costPrice);
      totalCostOfGoods += costOfGoods;
      readingsWithCostPrice++;
    }
    
    if (!byFuelType[reading.fuelType]) {
      byFuelType[reading.fuelType] = {
        litres: 0,
        revenue: 0,
        cogs: 0
      };
    }
    byFuelType[reading.fuelType].litres += litres;
    byFuelType[reading.fuelType].revenue += revenue;
    byFuelType[reading.fuelType].cogs += costOfGoods;
  }
  
  // Get daily expenses — only approved/auto-approved
  const dailyExpenses = await Expense.sum('amount', {
    where: {
      stationId,
      expenseDate: queryDate,
      approvalStatus: { [Op.in]: ['approved', 'auto_approved'] }
    }
  }) || 0;
  
  const grossProfit = totalRevenue - totalCostOfGoods;
  const netProfit = grossProfit - dailyExpenses;
  
  return sendSuccess(res, {
    date: queryDate,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalCostOfGoods: parseFloat(totalCostOfGoods.toFixed(2)),
    dailyExpenses: parseFloat(dailyExpenses.toFixed(2)),
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    netProfit: parseFloat(netProfit.toFixed(2)),
    totalLitres: parseFloat(totalLitres.toFixed(3)),
    byFuelType,
    dataCompleteness: {
      totalReadings: readings.length,
      readingsWithCostPrice,
      readingsWithoutCostPrice: readings.length - readingsWithCostPrice,
      completenessPercentage: readings.length > 0 
        ? parseFloat(((readingsWithCostPrice / readings.length) * 100).toFixed(2))
        : 0
    }
  });
});

/**
 * Export profitable sales with cost price data
 * GET /api/v1/stations/:stationId/profit-export?month=2025-01&format=csv
 * Access: Owner only
 * Returns: CSV with only readings that have both cost price and sale price
 */
exports.exportProfitableData = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;
  const { month, format = 'json' } = req.query;
  
  // Verify station exists
  const station = await Station.findByPk(stationId);
  if (!station) throw new NotFoundError('Station', stationId);

  // Default to current month
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  
  // Parse month to get date range
  const [year, monthNum] = targetMonth.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0);
  
  // Get all readings for the month
  const readings = await NozzleReading.findAll({
    where: {
      stationId,
      readingDate: {
        [Op.between]: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
      }
    },
    attributes: ['id', 'litresSold', 'pricePerLitre', 'fuelType', 'readingDate']
  });

  // Build profitable sales data (only with cost price)
  let profitableSales = [];
  
  for (const reading of readings) {
    const litres = parseFloat(reading.litresSold || 0);
    const sellingPrice = parseFloat(reading.pricePerLitre || 0);
    const fuelType = reading.fuelType;
    
    // Get price data for this reading date
    const priceData = await FuelPrice.findOne({
      where: {
        stationId,
        fuelType,
        effectiveFrom: {
          [Op.lte]: reading.readingDate
        }
      },
      order: [['effectiveFrom', 'DESC']]
    });
    
    // ONLY include if cost price exists
    if (priceData?.costPrice) {
      const costPrice = parseFloat(priceData.costPrice);
      const revenue = litres * sellingPrice;
      const cogs = litres * costPrice;
      const profit = revenue - cogs;
      const profitMargin = revenue > 0 ? ((profit / revenue) * 100) : 0;
      
      profitableSales.push({
        date: reading.readingDate,
        fuelType: fuelType,
        litres: parseFloat(litres.toFixed(2)),
        salePrice: parseFloat(sellingPrice.toFixed(2)),
        costPrice: parseFloat(costPrice.toFixed(2)),
        revenue: parseFloat(revenue.toFixed(2)),
        cogs: parseFloat(cogs.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        profitMargin: parseFloat(profitMargin.toFixed(2))
      });
    }
  }
  
  // Calculate totals
  const totals = {
    totalLitres: profitableSales.reduce((sum, item) => sum + item.litres, 0),
    totalRevenue: profitableSales.reduce((sum, item) => sum + item.revenue, 0),
    totalCogs: profitableSales.reduce((sum, item) => sum + item.cogs, 0),
    totalProfit: profitableSales.reduce((sum, item) => sum + item.profit, 0)
  };
  
  totals.avgProfitMargin = totals.totalRevenue > 0 
    ? (totals.totalProfit / totals.totalRevenue * 100)
    : 0;
  
  // Format response
  if (format === 'csv') {
    // Generate CSV
    const headers = ['Date', 'Fuel Type', 'Litres', 'Sale Price/L', 'Cost Price/L', 'Revenue', 'COGS', 'Profit', 'Profit %'];
    const rows = profitableSales.map(item => [
      item.date,
      item.fuelType,
      item.litres,
      item.salePrice,
      item.costPrice,
      item.revenue,
      item.cogs,
      item.profit,
      item.profitMargin
    ]);
    
    // Add totals row
    rows.push([
      'TOTALS',
      '',
      parseFloat(totals.totalLitres.toFixed(2)),
      '',
      '',
      parseFloat(totals.totalRevenue.toFixed(2)),
      parseFloat(totals.totalCogs.toFixed(2)),
      parseFloat(totals.totalProfit.toFixed(2)),
      parseFloat(totals.avgProfitMargin.toFixed(2))
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="profit-${stationId}-${targetMonth}.csv"`);
    res.send(csv);
  } else {
    // JSON format
    // Log audit
    await logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      stationId,
      action: 'READ',
      entityType: 'ProfitExport',
      entityId: stationId,
      category: 'analytics',
      severity: 'info',
      description: `Exported profitable sales for ${targetMonth} (${profitableSales.length} records with cost price)`
    });
    
    return sendSuccess(res, {
      month: targetMonth,
      station: {
        id: stationId,
        name: station.name
      },
      sales: profitableSales,
      totals: {
        recordsExported: profitableSales.length,
        totalLitres: parseFloat(totals.totalLitres.toFixed(2)),
        totalRevenue: parseFloat(totals.totalRevenue.toFixed(2)),
        totalCogs: parseFloat(totals.totalCogs.toFixed(2)),
        totalProfit: parseFloat(totals.totalProfit.toFixed(2)),
        avgProfitMargin: parseFloat(totals.avgProfitMargin.toFixed(2))
      },
      note: 'Only includes sales with BOTH cost price and sale price data'
    });
  }
});

