/**
 * Profitability Report DTO
 * Combines sales revenue, COGS, expenses to calculate net profit
 */

export class ProfitabilitySummaryDto {
  month!: string; // YYYY-MM
  stationId!: string;

  // Revenue
  totalRevenue!: number;
  totalLitres!: number;

  // Costs
  totalCostOfGoods!: number; // fuel cost
  totalExpenses!: number; // approved expenses only
  pendingExpenses!: number; // pending approval (excluded from net profit)

  // Profit tiers
  grossProfit!: number; // revenue - cogs
  netProfit!: number; // grossProfit - approvedExpenses
  profitMargin!: number; // netProfit / totalRevenue * 100
  profitPerLitre!: number; // netProfit / totalLitres
}

export class ProfitSummaryResponseDto extends ProfitabilitySummaryDto {
  breakdown!: {
    byFuelType: Record<string, {
      litres: number;
      revenue: number;
      costOfGoods: number;
      profit: number;
      profitMargin: number;
      profitPerLitre: number;
    }>;
    byExpenseCategory: Array<{
      category: string;
      label: string;
      amount: number;
    }>;
    readingDetails?: Record<string, any>;
  };

  dataCompleteness!: {
    totalReadings: number;
    readingsUsedForCalculation: number;
    readingsExcluded: number;
    completenessPercentage: number;
    note: string;
  };
}

export class DailyProfitDto {
  date!: string; // YYYY-MM-DD
  stationId!: string;

  totalRevenue!: number;
  totalCostOfGoods!: number;
  dailyExpenses!: number; // approved only
  grossProfit!: number;
  netProfit!: number;
  totalLitres!: number;

  byFuelType?: Record<string, {
    litres: number;
    revenue: number;
    costOfGoods: number;
  }>;

  dataCompleteness?: {
    totalReadings: number;
    readingsWithCostPrice: number;
    readingsWithoutCostPrice: number;
    completenessPercentage: number;
  };
}

export class NetProfitTrendDto {
  period!: 'daily' | 'monthly' | 'quarterly' | 'yearly';
  stationId!: string;
  startDate!: string;
  endDate!: string;

  totals!: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    avgProfitMargin: number;
  };

  trends!: Array<{
    date: string;
    revenue: number;
    expenses: number;
    netProfit: number;
    profitMargin: number;
  }>;
}
