import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { extractNestedData, extractApiData } from "@/lib/api-response";

interface DashboardData {
  todaySales: number;
  todayPayments: number;
  totalReadings: number;
  // Preserve API 'today' object for components expecting the original shape
  today?: {
    litres: number;
    amount: number;
    cash: number;
    online: number;
    credit: number;
    readings: number;
  } | null;
  lastReading: string | null;
  pendingClosures: number;
  trendsData: Array<{
    date: string;
    sales: number;
    payments: number;
  }>;
  fuelPrices: {
    petrol?: number;
    diesel?: number;
    cng?: number;
  };
  pumps?: Array<{
    id: string;
    name: string;
    number: number;
    status: string;
    nozzleCount: number;
    activeNozzles: number;
    today?: { litres: number; amount: number };
  }>;
  alerts: Array<{
    id: string;
    type: 'warning' | 'info' | 'error';
    message: string;
    severity: 'low' | 'medium' | 'high';
    tags: string[];
  }>;
}

export const useDashboardData = (stationId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['dashboard', stationId || user?.stations?.[0]?.id],
    queryFn: async (): Promise<DashboardData> => {
      // If no stationId, try to use user's first station
      const effectiveStationId = stationId || user?.stations?.[0]?.id;
      if (!effectiveStationId) {
        return {
          todaySales: 0,
          todayPayments: 0,
          totalReadings: 0,
          today: null,
          lastReading: null,
          pendingClosures: 0,
          trendsData: [],
          fuelPrices: {},
          pumps: [],
          alerts: [{
            id: 'no_stations',
            type: 'info',
            message: 'No stations found. Create a station to start tracking sales.',
            severity: 'medium',
            tags: ['setup']
          }]
        };
      }

      try {
        const today = new Date().toISOString().split('T')[0];

        // Fetch dashboard summary from backend
        const summary = await apiClient.get<{
          date: string;
          today: {
            litres: number;
            amount: number;
            cash: number;
            online: number;
            credit: number;
            readings: number;
          };
          creditOutstanding: number;
          pumps: Array<{
            id: string;
            name: string;
            number: number;
            status: string;
            nozzleCount: number;
            activeNozzles: number;
            today: { litres: number; amount: number };
          }>;
        }>(`/analytics/summary?stationId=${effectiveStationId}&startDate=${today}&endDate=${today}`);

        // The apiClient returns the envelope { success, data } — unwrap it safely
        const summaryData = extractApiData(summary, null) as {
          date: string;
          today?: {
            litres: number;
            amount: number;
            cash: number;
            online: number;
            credit: number;
            readings: number;
          };
          creditOutstanding?: number;
          pumps?: Array<{
            id: string;
            name: string;
            number: number;
            status: string;
            nozzleCount: number;
            activeNozzles: number;
            today?: { litres: number; amount: number };
          }>;
        } | null;

        // Fetch 7-day trends data for managers and above
        let trendsData: Array<{ date: string; sales: number; payments: number }> = [];
        if (user?.role && ['manager', 'owner', 'super_admin'].includes(user.role)) {
          try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const startDate = sevenDaysAgo.toISOString().split('T')[0];
            const endDate = today;

            const trendsResponse = await apiClient.get<{
              success: boolean;
              data: Array<{
                date: string;
                litres: number;
                amount: number;
                cash: number;
                online: number;
                credit: number;
                readings: number;
              }>;
            }>(`/analytics/daily?startDate=${startDate}&endDate=${endDate}&stationId=${effectiveStationId}`);

            if (trendsResponse.success && trendsResponse.data) {
              trendsData = trendsResponse.data.map(day => ({
                date: day.date,
                sales: day.amount,
                payments: day.cash + day.online + day.credit
              }));
            }
          } catch (error) {
            // trendsData remains empty array
          }
        }

        // Get fuel prices from global cache and transform to expected format
        const globalQueryKey = ['all-fuel-prices', user?.stations?.map(s => s.id).sort().join(',')];
        const globalData = queryClient.getQueryData<Record<string, any[]>>(globalQueryKey);
        const rawFuelPrices = effectiveStationId && globalData ? globalData[effectiveStationId] || [] : [];

        // Ensure rawFuelPrices is not empty
        if (!rawFuelPrices.length) {
          console.warn('No fuel prices found for station:', effectiveStationId);
        }

        // Transform array format to object format expected by dashboard
        const fuelPrices: { petrol?: number; diesel?: number; cng?: number } = {};
        rawFuelPrices.forEach((price: any) => {
          const fuelType = price.fuel_type?.toLowerCase();
          if (fuelType && price.price_per_litre) {
            fuelPrices[fuelType as keyof typeof fuelPrices] = parseFloat(price.price_per_litre);
          } else {
            console.warn('Invalid fuel price entry:', price);
          }
        });

        return {
          todaySales: summaryData?.today?.amount ?? 0,
          todayPayments: (summaryData?.today?.cash ?? 0) + (summaryData?.today?.online ?? 0) + (summaryData?.today?.credit ?? 0),
          totalReadings: summaryData?.today?.readings ?? 0,
          today: summaryData?.today ?? null,
          pumps: summaryData?.pumps ?? [],
          lastReading: null, // Not available in current API
          pendingClosures: 0, // Not implemented yet
          trendsData,
          fuelPrices,
          alerts: []
        };
      } catch (error: unknown) {
        return {
          todaySales: 0,
          todayPayments: 0,
          totalReadings: 0,
          today: null,
          lastReading: null,
          pendingClosures: 0,
          trendsData: [],
          fuelPrices: {},
          pumps: [],
          alerts: [
            {
              id: 'load_error',
              type: 'error',
              message: error && typeof error === 'object' && 'message' in error ? (error as { message?: string }).message || 'Failed to load dashboard data' : 'Failed to load dashboard data',
              severity: 'high',
              tags: ['system']
            }
          ]
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
