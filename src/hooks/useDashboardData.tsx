import { useEffect, useState } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { extractNestedData } from "@/lib/api-response";

interface DashboardData {
  todaySales: number;
  todayTender: number;
  totalReadings: number;
  lastReading: string | null;
  pendingClosures: number;
  trendsData: Array<{
    date: string;
    sales: number;
    tender: number;
  }>;
  fuelPrices: {
    petrol?: number;
    diesel?: number;
    cng?: number;
  };
  alerts: Array<{
    id: string;
    type: 'warning' | 'info' | 'error';
    message: string;
    severity: 'low' | 'medium' | 'high';
    tags: string[];
  }>;
}

export const useDashboardData = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    todaySales: 0,
    todayTender: 0,
    totalReadings: 0,
    lastReading: null,
    pendingClosures: 0,
    trendsData: [],
    fuelPrices: {},
    alerts: []
  });
  const [isLoading, setIsLoading] = useState(true);

  const currentStation = user?.stations?.[0];

  useEffect(() => {
    // If user has no stations, stop loading and show empty state
    if (user && (!user.stations || user.stations.length === 0)) {
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
    
    if (currentStation) {
      loadDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentStation]);

  const loadDashboardData = async () => {
    if (!currentStation) {
      console.warn("No currentStation selected in useDashboardData");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // Fetch dashboard summary from backend
      // apiClient unwraps {success, data} to just data
      const summary = await apiClient.get<{
        totalSales: number;
        totalReadings: number;
        fuelSales: Record<string, { litres: number; amount: number }>;
        recentReadings: { createdAt?: string }[];
      }>(`/dashboard/summary?stationId=${currentStation.id}&startDate=${today}&endDate=${today}`);

      console.log('📊 Dashboard summary:', summary);

      // Extract fuel prices from current prices endpoint
      const fuelPrices: DashboardData['fuelPrices'] = {};
      try {
        type Price = { fuelType: string; price: number };
        const response = await apiClient.get<{ success: boolean; data: { current: Price[]; history: Price[] } }>(`/stations/${currentStation.id}/prices`);
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
        todaySales: summary.today?.amount || 0,
        todayTender: 0, // Not implemented yet
        totalReadings: summary.today?.readings || 0,
        lastReading: summary.recentReadings?.[0]?.createdAt || null,
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

  return { data, isLoading, refetch: loadDashboardData };
};
