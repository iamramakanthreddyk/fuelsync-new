/**
 * Dashboard Model
 * 
 * Types and interfaces for dashboard views and analytics.
 * 
 * @module core/models/dashboard
 */

import { FuelType, PaymentMethod, ShiftType, AlertSeverity, AlertCategory } from '../enums';

// ============================================
// DASHBOARD SUMMARY
// ============================================

/**
 * Main dashboard summary
 */
export interface DashboardSummary {
  totalSales: number;
  totalVolume: number;
  totalTransactions: number;
  avgTransactionValue: number;
  salesGrowth: number;
  volumeGrowth: number;
  lastUpdated: string;
}

/**
 * Daily totals for dashboard
 */
export interface DailyTotals {
  date: string;
  totalSales: number;
  totalVolume: number;
  transactions: number;
  byFuelType: Record<FuelType, {
    volume: number;
    sales: number;
    transactions: number;
  }>;
  byPaymentMethod: Record<PaymentMethod, {
    amount: number;
    transactions: number;
  }>;
}

/**
 * Fuel breakdown for dashboard
 */
export interface FuelBreakdown {
  fuelType: FuelType;
  volume: number;
  sales: number;
  transactions: number;
  percentage: number;
  avgPrice: number;
}

/**
 * Pump performance data
 */
export interface PumpPerformance {
  pumpId: string;
  pumpNumber: number;
  totalVolume: number;
  totalSales: number;
  transactions: number;
  avgTransactionVolume: number;
  activeTime: number;
  idleTime: number;
  efficiency: number;
}

/**
 * Financial overview for dashboard
 */
export interface FinancialOverviewData {
  grossSales: number;
  netSales: number;
  cashSales: number;
  digitalSales: number;
  creditSales: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  cashOnHand: number;
  creditOutstanding: number;
}

// ============================================
// ANALYTICS DATA
// ============================================

/**
 * Sales trend data point
 */
export interface SalesTrendPoint {
  date: string;
  sales: number;
  volume: number;
  transactions: number;
}

/**
 * Sales analytics
 */
export interface SalesAnalytics {
  period: string;
  totalSales: number;
  totalVolume: number;
  totalTransactions: number;
  avgDailySales: number;
  avgDailyVolume: number;
  peakDay: string;
  peakDaySales: number;
  lowDay: string;
  lowDaySales: number;
  trend: SalesTrendPoint[];
  growthRate: number;
}

/**
 * Fuel sales comparison
 */
export interface FuelComparison {
  fuelType: FuelType;
  currentPeriod: {
    volume: number;
    sales: number;
    avgPrice: number;
  };
  previousPeriod: {
    volume: number;
    sales: number;
    avgPrice: number;
  };
  volumeChange: number;
  salesChange: number;
  priceChange: number;
}

/**
 * Shift performance comparison
 */
export interface ShiftComparison {
  shiftType: ShiftType;
  sales: number;
  volume: number;
  transactions: number;
  avgTransactionValue: number;
  percentage: number;
}

// ============================================
// WIDGET DATA
// ============================================

/**
 * KPI widget data
 */
export interface KPIWidget {
  id: string;
  title: string;
  value: number;
  formattedValue: string;
  change: number;
  changeLabel: string;
  trend: 'up' | 'down' | 'neutral';
  icon?: string;
  color?: string;
}

/**
 * Chart widget data
 */
export interface ChartWidget {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'donut' | 'area';
  data: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

/**
 * Table widget data
 */
export interface TableWidget<T = Record<string, unknown>> {
  id: string;
  title: string;
  columns: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    width?: string;
  }>;
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

// ============================================
// ALERTS & NOTIFICATIONS
// ============================================

/**
 * Dashboard alert
 */
export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

/**
 * Alert summary
 */
export interface AlertSummary {
  total: number;
  unread: number;
  bySeverity: Record<AlertSeverity, number>;
  byCategory: Record<AlertCategory, number>;
  recentAlerts: DashboardAlert[];
}

// ============================================
// QUICK STATS
// ============================================

/**
 * Inventory quick stats
 */
export interface InventoryQuickStats {
  totalTanks: number;
  totalCapacity: number;
  currentStock: number;
  stockValue: number;
  tanksLow: number;
  tanksCritical: number;
}

/**
 * Employee quick stats
 */
export interface EmployeeQuickStats {
  totalEmployees: number;
  activeToday: number;
  onShift: number;
  shiftsToday: number;
  pendingHandovers: number;
}

/**
 * Credit quick stats
 */
export interface CreditQuickStats {
  totalCreditors: number;
  activeCreditors: number;
  totalOutstanding: number;
  overdueAmount: number;
  overdueCount: number;
}

// ============================================
// DASHBOARD FILTERS
// ============================================

/**
 * Dashboard filter options
 */
export interface DashboardFilters {
  stationId?: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  fuelTypes?: FuelType[];
  paymentMethods?: PaymentMethod[];
  shiftTypes?: ShiftType[];
  comparison?: {
    enabled: boolean;
    type: 'previous_period' | 'same_period_last_year';
  };
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  refreshInterval: number;
  showComparison: boolean;
  defaultDateRange: string;
  visibleWidgets: string[];
  widgetLayout: Array<{
    id: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }>;
}

// ============================================
// REPORT DATA
// ============================================

/**
 * Daily closure report
 */
export interface DailyClosureReport {
  date: string;
  stationId: string;
  stationName: string;
  summary: {
    totalSales: number;
    totalVolume: number;
    totalTransactions: number;
    cashCollected: number;
    digitalPayments: number;
    creditSales: number;
  };
  shifts: Array<{
    shiftType: ShiftType;
    employeeName: string;
    sales: number;
    volume: number;
    cashHandover: number;
    status: string;
  }>;
  fuelBreakdown: FuelBreakdown[];
  expenses: Array<{
    category: string;
    amount: number;
  }>;
  variance: {
    expected: number;
    actual: number;
    difference: number;
  };
  generatedAt: string;
  generatedBy: string;
}

/**
 * Sales report
 */
export interface SalesReport {
  period: {
    startDate: string;
    endDate: string;
  };
  stationId: string;
  stationName: string;
  summary: SalesAnalytics;
  dailyData: DailyTotals[];
  fuelComparison: FuelComparison[];
  shiftComparison: ShiftComparison[];
  topPerformingDays: Array<{
    date: string;
    sales: number;
    volume: number;
  }>;
  paymentBreakdown: Array<{
    method: PaymentMethod;
    amount: number;
    percentage: number;
  }>;
  generatedAt: string;
}
