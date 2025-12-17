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
        }>(`/dashboard/summary?stationId=${effectiveStationId}&startDate=${today}&endDate=${today}`);

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

        // Extract fuel prices from global cache instead of making API call
        const fuelPrices: DashboardData['fuelPrices'] = {};
        try {
          // Use the global fuel prices cache
          const stations = user?.stations || [];
          const globalPrices = queryClient.getQueryData<Record<string, any[]>>(['all-fuel-prices', stations.map(s => s.id).sort().join(',')]);

          if (globalPrices && globalPrices[effectiveStationId]) {
            globalPrices[effectiveStationId].forEach((price: any) => {
              const fuelType = (price.fuel_type || price.fuelType || '').toLowerCase();
              if (fuelType && price.price_per_litre) {
                fuelPrices[fuelType as keyof typeof fuelPrices] = price.price_per_litre;
              }
            });
          }
        } catch (e) {
          console.warn('Could not load fuel prices from cache:', e);
        }

        return {
          todaySales: summaryData?.today?.amount ?? 0,
          todayPayments: (summaryData?.today?.cash ?? 0) + (summaryData?.today?.online ?? 0) + (summaryData?.today?.credit ?? 0),
          totalReadings: summaryData?.today?.readings ?? 0,
          today: summaryData?.today ?? null,
          pumps: summaryData?.pumps ?? [],
          lastReading: null, // Not available in current API
          pendingClosures: 0, // Not implemented yet
          trendsData: [],
          fuelPrices,
          alerts: []
        };
      } catch (error: unknown) {
        console.error('Error loading dashboard data:', error);
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
    enabled: !!stationId || !!user?.stations?.[0]?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
