/**
 * useDailySummary Hook
 * 
 * Fetches daily summary data from the analytics API.
 * Uses the actual backend endpoints:
 * - GET /api/v1/analytics/summary
 * - GET /api/v1/analytics/financial
 * - GET /api/v1/analytics/daily
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/lib/api-client";
import { useRoleAccess } from "./useRoleAccess";

interface DailySummaryData {
  sales_total: number;
  payments_total: number;
  difference: number;
  breakdown: {
    cash: number;
    card: number;
    upi: number;
    credit: number;
  };
  date: string;
  closedAt?: string;
  closedBy?: string;
}

interface DashboardDailyResponse {
  date: string;
  litres?: number;
  amount?: number;
  cash?: number;
  online?: number;
  credit?: number;
  readings?: number;
  totalSales?: number; // Keep for backward compatibility
  totalVolume?: number;
  fuelSales?: number;
  cashSales?: number;
  onlineSales?: number;
  creditSales?: number;
}

interface FinancialOverviewResponse {
  grossSales?: number;
  netSales?: number;
  cashOnHand?: number;
  creditOutstanding?: number;
}

export function useDailySummary(date: string) {
  const { currentStation, isAdmin, isOwner } = useRoleAccess();
  const stationId = currentStation?.id;

  return useQuery<DailySummaryData>({
    queryKey: ['daily-summary', date, stationId],
    queryFn: async () => {
      // Build query params
      const params = new URLSearchParams();
      params.set('startDate', date);
      params.set('endDate', date);
      if (stationId) params.set('stationId', stationId);

      try {
        // For managers, only fetch daily data (financial overview requires owner+ permissions)
        if (!isOwner && !isAdmin) {
          const dailyResponse = await apiClient.get<ApiResponse<DashboardDailyResponse[]>>(`/analytics/daily?${params.toString()}`);
          
          const dailyData = dailyResponse.success && dailyResponse.data?.[0] 
            ? dailyResponse.data[0] 
            : null;

          // Calculate totals from daily data only
          const salesTotal = dailyData?.amount ?? dailyData?.totalSales ?? 0;
          const cashAmount = dailyData?.cash ?? dailyData?.cashSales ?? 0;
          const onlineAmount = dailyData?.online ?? dailyData?.onlineSales ?? 0;
          const creditAmount = dailyData?.credit ?? dailyData?.creditSales ?? 0;

          return {
            sales_total: salesTotal,
            payments_total: cashAmount + onlineAmount,
            difference: salesTotal - (cashAmount + onlineAmount),
            breakdown: {
              cash: cashAmount,
              card: 0, // Not available in daily endpoint
              upi: onlineAmount,
              credit: creditAmount
            },
            date,
            closedAt: undefined,
            closedBy: undefined
          };
        }

        // For owners/admins, fetch both daily and financial data
        const [dailyResponse, financialResponse] = await Promise.all([
          apiClient.get<ApiResponse<DashboardDailyResponse[]>>(`/analytics/daily?${params.toString()}`),
          apiClient.get<ApiResponse<FinancialOverviewResponse>>(`/analytics/financial?${params.toString()}`)
        ]);

        // Extract data with defaults
        const dailyData = dailyResponse.success && dailyResponse.data?.[0] 
          ? dailyResponse.data[0] 
          : null;
        
        const financialData = financialResponse.success && financialResponse.data 
          ? financialResponse.data 
          : null;

        // Calculate totals from available data
        const salesTotal = dailyData?.amount ?? dailyData?.totalSales ?? financialData?.grossSales ?? 0;
        const cashAmount = dailyData?.cash ?? dailyData?.cashSales ?? financialData?.cashOnHand ?? 0;
        const creditAmount = dailyData?.credit ?? dailyData?.creditSales ?? financialData?.creditOutstanding ?? 0;
        const onlineAmount = dailyData?.online ?? dailyData?.onlineSales ?? 0;
        
        // Card/UPI breakdown - split online payments (approximation if not available separately)
        const cardAmount = onlineAmount * 0.5;  // Approximate
        const upiAmount = onlineAmount * 0.5;   // Approximate
        
        const paymentsTotal = cashAmount + onlineAmount + creditAmount;
        const difference = salesTotal - paymentsTotal;

        return {
          sales_total: salesTotal,
          payments_total: paymentsTotal,
          difference,
          breakdown: {
            cash: cashAmount,
            card: cardAmount,
            upi: upiAmount,
            credit: creditAmount
          },
          date
        };
      } catch (error) {
        // Return empty data on error
        return {
          sales_total: 0,
          payments_total: 0,
          difference: 0,
          breakdown: { cash: 0, card: 0, upi: 0, credit: 0 },
          date
        };
      }
    },
    enabled: isAdmin || !!stationId, // Only fetch if admin or station is selected
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false
  });
}
