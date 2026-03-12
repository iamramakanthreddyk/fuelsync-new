import { describe, it, expect } from 'vitest';
import { calculateProfit, calculateCOGS, calculateProfitMargin, calculateAggregateProfits } from '../lib/profit-utils';

describe('Profit Calculation Utils', () => {
  describe('calculateCOGS', () => {
    it('uses actual COGS if provided', () => {
      expect(calculateCOGS(1000, 800)).toBe(800);
    });
    it('defaults to 98% of revenue if COGS missing', () => {
      expect(calculateCOGS(1000, null)).toBe(980);
      expect(calculateCOGS(1000, undefined)).toBe(980);
      expect(calculateCOGS(1000)).toBe(980);
    });
    it('handles zero revenue', () => {
      expect(calculateCOGS(0, null)).toBe(0);
    });
  });

  describe('calculateProfit', () => {
    it('calculates net profit with all params', () => {
      expect(calculateProfit(1000, 100, 50, 800)).toBe(50); // 1000-800-100-50
    });
    it('handles missing COGS (uses 98%)', () => {
      expect(calculateProfit(1000, 100, 50)).toBe(-130); // 1000-980-100-50
    });
    it('handles zero expenses/shortfall', () => {
      expect(calculateProfit(1000, 0, 0, 800)).toBe(200);
    });
    it('handles zero revenue', () => {
      expect(calculateProfit(0, 0, 0, 0)).toBe(0);
    });
  });

  describe('calculateProfitMargin', () => {
    it('calculates margin %', () => {
      expect(calculateProfitMargin(1000, 100)).toBe(10);
    });
    it('returns 0 if revenue is 0', () => {
      expect(calculateProfitMargin(0, 100)).toBe(0);
    });
  });

  describe('calculateAggregateProfits', () => {
    it('aggregates multiple days with actual COGS', () => {
      const days = [
        { revenue: 1000, expenses: 100, shortfall: 50, actualCogs: 800 },
        { revenue: 2000, expenses: 200, shortfall: 100, actualCogs: 1500 }
      ];
      const result = calculateAggregateProfits(days);
      expect(result.totalRevenue).toBe(3000);
      expect(result.totalCogs).toBe(2300);
      expect(result.totalExpenses).toBe(300);
      expect(result.totalShortfall).toBe(150);
      expect(result.totalProfit).toBe(250);
      expect(result.profitMargin).toBeCloseTo(8.33, 2);
    });
    it('handles missing COGS for some days', () => {
      const days = [
        { revenue: 1000, expenses: 100, shortfall: 50, actualCogs: null }, // uses 980
        { revenue: 2000, expenses: 200, shortfall: 100, actualCogs: 1500 }
      ];
      const result = calculateAggregateProfits(days);
      expect(result.totalCogs).toBe(980 + 1500);
      expect(result.totalProfit).toBe(1000-980-100-50 + 2000-1500-200-100);
    });
    it('handles multiple fuel types with missing cost price', () => {
      const days = [
        { revenue: 500, expenses: 20, shortfall: 0, actualCogs: null }, // 500-490-20 = -10
        { revenue: 700, expenses: 30, shortfall: 0, actualCogs: 600 }, // 700-600-30 = 70
        { revenue: 0, expenses: 0, shortfall: 0, actualCogs: null } // 0
      ];
      const result = calculateAggregateProfits(days);
      expect(result.totalProfit).toBeCloseTo(-10 + 70, 2);
    });
  });
});
