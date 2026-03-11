/**
 * Profit Calculation Utilities
 * Handles COGS (Cost of Goods Sold) and Profit calculations
 * If cost price is not available, assumes 2% profit margin (98% COGS)
 */

/**
 * Calculate COGS (Cost of Goods Sold)
 * If actual cost price is provided, use it
 * Otherwise, assume 2% profit margin (COGS = Revenue × 0.98)
 */
export function calculateCOGS(revenue: number, actualCogs?: number | null): number {
  if (actualCogs !== null && actualCogs !== undefined && actualCogs > 0) {
    return actualCogs;  // Use actual cost price if available
  }
  return revenue * 0.98;  // Assume 2% profit (98% COGS) if not available
}

/**
 * Calculate Net Profit
 * Formula: Revenue - COGS - Expenses - Shortfall = Profit
 */
export function calculateProfit(
  revenue: number,
  expenses: number = 0,
  shortfall: number = 0,
  actualCogs?: number | null
): number {
  const cogs = calculateCOGS(revenue, actualCogs);
  return revenue - cogs - expenses - shortfall;
}

/**
 * Calculate Profit Margin Percentage
 */
export function calculateProfitMargin(revenue: number, profit: number): number {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}

/**
 * Helper function for bulk profit calculations (30-day, 60-day, year reports)
 * Takes array of daily data and calculates aggregated profits
 */
export function calculateAggregateProfits(
  dailyData: Array<{
    revenue: number;
    expenses?: number;
    shortfall?: number;
    actualCogs?: number | null;
  }>
): {
  totalRevenue: number;
  totalCogs: number;
  totalExpenses: number;
  totalShortfall: number;
  totalProfit: number;
  profitMargin: number;
} {
  const totals = dailyData.reduce(
    (acc, day) => {
      const revenue = day.revenue || 0;
      const expenses = day.expenses || 0;
      const shortfall = day.shortfall || 0;
      const cogs = calculateCOGS(revenue, day.actualCogs);

      acc.totalRevenue += revenue;
      acc.totalCogs += cogs;
      acc.totalExpenses += expenses;
      acc.totalShortfall += shortfall;
      acc.totalProfit += revenue - cogs - expenses - shortfall;

      return acc;
    },
    {
      totalRevenue: 0,
      totalCogs: 0,
      totalExpenses: 0,
      totalShortfall: 0,
      totalProfit: 0
    }
  );

  return {
    ...totals,
    profitMargin: calculateProfitMargin(totals.totalRevenue, totals.totalProfit)
  };
}
