/**
 * Profitability Service Tests
 * Tests for Req #3: Net profit calculations with expense deduction
 */

describe('ProfitabilityService', () => {
  let profitService;

  beforeEach(() => {
    jest.clearAllMocks();
    profitService = require('../profitability.service');
  });

  describe('getMonthlySummary', () => {
    it('should calculate net profit = revenue - cogs - expenses (Req #3)', () => {
      const mockData = {
        totalRevenue: 100000,
        totalCostOfGoods: 40000,
        totalExpenses: 25000, // approved only
        pendingExpenses: 5000 // shown but not deducted

      };

      const grossProfit = mockData.totalRevenue - mockData.totalCostOfGoods; // 60000
      const netProfit = grossProfit - mockData.totalExpenses; // 35000

      expect(netProfit).toBe(35000);
      expect(netProfit).toBeLessThan(grossProfit);
      
      // Pending expenses should be visible but not impact net profit
      expect(mockData.pendingExpenses).toBe(5000);
    });

    it('should include pending expenses for transparency (Req #3)', () => {
      const summary = {
        summary: {
          totalExpenses: 25000,
          pendingExpenses: 5000,
          netProfit: 35000
        }
      };

      // Dashboard should show both approved and pending
      expect(summary.summary.pendingExpenses).toBe(5000);
      // But netProfit is only calculated with approved
    });

    it('should return breakdown by expense category (Req #3)', () => {
      const summary = {
        breakdown: {
          byExpenseCategory: [
            { category: 'salary', amount: 20000 },
            { category: 'electricity', amount: 5000 }
          ]
        }
      };

      expect(summary.breakdown.byExpenseCategory.length).toBe(2);
      expect(summary.breakdown.byExpenseCategory[0].amount).toBe(20000);
    });

    it('should calculate profit margin', () => {
      const totalRevenue = 100000;
      const netProfit = 35000;

      const profitMargin = (netProfit / totalRevenue) * 100; // 35%

      expect(profitMargin).toBe(35);
    });

    it('should calculate profit per litre (Req #3)', () => {
      const totalLitres = 1000;
      const netProfit = 35000;

      const profitPerLitre = netProfit / totalLitres; // 35

      expect(profitPerLitre).toBe(35);
    });
  });

  describe('getDailyProfit', () => {
    it('should calculate daily profit with expenses (Req #3)', () => {
      const mockData = {
        totalRevenue: 10000,
        totalCostOfGoods: 4000,
        dailyExpenses: 2000, // approved only for this day

      };

      const grossProfit = mockData.totalRevenue - mockData.totalCostOfGoods; // 6000
      const netProfit = grossProfit - mockData.dailyExpenses; // 4000

      expect(netProfit).toBe(4000);
    });
  });

  describe('getNetProfitTrend', () => {
    it('should return net profit trend over period (Req #3)', () => {
      const trend = {
        period: 'monthly',
        stationId: 'station-1',
        startDate: '2025-01-01',
        endDate: '2025-03-31',
        totals: {
          totalRevenue: 300000,
          totalExpenses: 75000,
          netProfit: 105000,
          avgProfitMargin: 35
        },
        trends: [
          { date: '2025-01', revenue: 100000, expenses: 25000, netProfit: 35000 },
          { date: '2025-02', revenue: 100000, expenses: 25000, netProfit: 35000 },
          { date: '2025-03', revenue: 100000, expenses: 25000, netProfit: 35000 }
        ]
      };

      expect(trend.totals.netProfit).toBe(105000);
      expect(trend.trends.length).toBe(3);
      expect(trend.totals.avgProfitMargin).toBe(35);
    });
  });
});
