/**
 * useDailySummary Hook
 * 
 * Fetches daily summary data from the dashboard API.
 * Uses the actual backend endpoints:
 * - GET /api/v1/dashboard/summary
 * - GET /api/v1/dashboard/financial-overview
 * - GET /api/v1/dashboard/daily
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/lib/api-client";
import { useRoleAccess } from "./useRoleAccess";

interface DailySummaryData {
  sales_total: number;
  tender_total: number;
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
  totalSales?: number;
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
  const { currentStation, isAdmin } = useRoleAccess();
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
        // Fetch daily data and financial overview in parallel
        const [dailyResponse, financialResponse] = await Promise.all([
          apiClient.get<ApiResponse<DashboardDailyResponse[]>>(`/dashboard/daily?${params.toString()}`),
          apiClient.get<ApiResponse<FinancialOverviewResponse>>(`/dashboard/financial-overview?${params.toString()}`)
        ]);

        // Extract data with defaults
        const dailyData = dailyResponse.success && dailyResponse.data?.[0] 
          ? dailyResponse.data[0] 
          : null;
        
        const financialData = financialResponse.success && financialResponse.data 
          ? financialResponse.data 
          : null;

        // Calculate totals from available data
        const salesTotal = dailyData?.totalSales ?? financialData?.grossSales ?? 0;
        const cashAmount = dailyData?.cashSales ?? financialData?.cashOnHand ?? 0;
        const creditAmount = dailyData?.creditSales ?? financialData?.creditOutstanding ?? 0;
        const onlineAmount = dailyData?.onlineSales ?? 0;
        
        // Card/UPI breakdown - split online payments (approximation if not available separately)
        const cardAmount = onlineAmount * 0.5;  // Approximate
        const upiAmount = onlineAmount * 0.5;   // Approximate
        
        const tenderTotal = cashAmount + onlineAmount + creditAmount;
        const difference = salesTotal - tenderTotal;

        return {
          sales_total: salesTotal,
          tender_total: tenderTotal,
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
        console.error('[useDailySummary] Failed to fetch data:', error);
        // Return empty data on error
        return {
          sales_total: 0,
          tender_total: 0,
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
