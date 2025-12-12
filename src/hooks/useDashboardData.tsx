import { useEffect, useState } from 'react';
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
  const [data, setData] = useState<DashboardData>({
    todaySales: 0,
    todayPayments: 0,
    totalReadings: 0,
    today: null,
    lastReading: null,
    pendingClosures: 0,
    trendsData: [],
    fuelPrices: {},
    pumps: [],
    alerts: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // If no stationId, try to use user's first station
    const effectiveStationId = stationId || user?.stations?.[0]?.id;
    if (!effectiveStationId) {
      setIsLoading(false);
      setData(prev => ({
        ...prev,
        alerts: [{
          id: 'no_stations',
          type: 'info',
          message: 'No stations found. Create a station to start tracking sales.',
          severity: 'medium',
          tags: ['setup']
        }]
      }));
      return;
    }

    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
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

        // Extract fuel prices from current prices endpoint
        const fuelPrices: DashboardData['fuelPrices'] = {};
        try {
          type Price = { fuelType: string; price: number };
          const response = await apiClient.get<{ success: boolean; data: { current: Price[]; history: Price[] } }>(`/stations/${effectiveStationId}/prices`);
          // Extract nested 'current' array from the wrapped response
          const currentPrices = extractNestedData(response, 'current', []);
          if (Array.isArray(currentPrices)) {
            currentPrices.forEach((p: Price) => {
              fuelPrices[p.fuelType as keyof typeof fuelPrices] = p.price;
            });
          }
        } catch (e) {
          console.warn('Could not load fuel prices:', e);
        }

        setData({
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
        });
      } catch (error: unknown) {
        console.error('Error loading dashboard data:', error);
        setData(prev => ({
          ...prev,
          alerts: [
            {
              id: 'load_error',
              type: 'error',
              message: error && typeof error === 'object' && 'message' in error ? (error as { message?: string }).message || 'Failed to load dashboard data' : 'Failed to load dashboard data',
              severity: 'high',
              tags: ['system']
            }
          ]
        }));
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
    // Only re-run when stationId or user changes
  }, [stationId, user]);

  return { data, isLoading };
};
