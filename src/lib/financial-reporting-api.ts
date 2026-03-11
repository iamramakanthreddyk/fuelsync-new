/**
 * @deprecated Import from "@/api" or "@/api/analytics" instead.
 * This file is a compatibility shim -- all exports now live in src/api/analytics.ts.
 */
export {
  analyticsApi,
  calculateTotalSales,
  calculateTotalLitres,
  parseSalesAmount,
  groupSalesByStation,
  calculateFinancialRatios,
} from "@/api/analytics";
export type {
  OwnerStats,
  OwnerAnalytics,
  IncomeReceivablesReport,
  ProfitSummary,
  SalesData,
} from "@/api/analytics";

// Legacy function wrappers for backward compatibility
import { analyticsApi } from "@/api/analytics";

export async function getOwnerStats(ownerId?: string) {
  return analyticsApi.getOwnerStats(ownerId);
}

export async function getOwnerAnalytics(startDate: string, endDate: string, stationId?: string) {
  return analyticsApi.getOwnerAnalytics(startDate, endDate, stationId);
}

export async function getIncomeReceivablesReport(stationId: string, startDate: string, endDate: string) {
  return analyticsApi.getIncomeReceivables(stationId, startDate, endDate);
}

export async function getProfitSummary(stationId: string, month?: string) {
  return analyticsApi.getProfitSummary(stationId, month);
}

export async function getSalesAnalysis(startDate: string, endDate: string, stationId?: string) {
  return analyticsApi.getSalesAnalysis(startDate, endDate, stationId);
}
