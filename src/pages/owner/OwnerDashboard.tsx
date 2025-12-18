/**
 * Owner Dashboard - Main Overview
 * Displays station metrics, quick actions, and recent activity
 * 
 * Architecture: Uses modular subcomponents for maintainability
 * - StatsGrid: KPI cards (stations, employees, sales)
 * - PlanInfoAlert: Subscription plan usage display
 * - StationsCard: Station list with performance metrics
 * - PendingActionsAlert: Notification for pending actions
 * - QuickActionsGrid: Header quick action buttons
 * - QuickEntryCardsGrid: Bottom navigation cards
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { extractApiData } from '@/lib/api-response';
import { useStations, usePumps } from '@/hooks/api';
import {
  StatsGrid,
  PlanInfoAlert,
  StationsCard,
  PendingActionsAlert,
  QuickActionsGrid,
  QuickEntryCardsGrid,
  SetupWarningsAlert
} from '@/components/owner';

// Types
interface DashboardStats {
  totalStations?: number;
  activeStations?: number;
  totalEmployees?: number;
  todaySales?: number;
  monthSales?: number;
  pendingActions?: number;
}

interface Station {
  id: string;
  name: string;
  code?: string;
  pumpCount?: number;
  activePumps?: number;
  todaySales?: number;
  lastReading?: string;
}

export default function OwnerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect if not owner
  useEffect(() => {
    if (user && user.role !== 'owner') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Fetch dashboard stats
  const { data: statsResponse, isLoading: statsLoading } = useQuery<{
    success: boolean;
    data: DashboardStats;
  } | null>({
    queryKey: ['owner-dashboard-stats', user?.id],
    queryFn: async () => {
      try {
        // Include user ID as query parameter for logging/debugging
        // (Backend always uses authenticated user's ID for security)
        const response = await apiClient.get<{
          success: boolean;
          data: DashboardStats;
        }>(`/dashboard/owner/stats${user?.id ? `?ownerId=${user.id}` : ''}`);
        return response ?? null;
      } catch (error) {
        return null;
      }
    },
    enabled: !!user
  });

  // Unwrap stats from API response
  const stats = statsResponse?.data ?? null;

  // Fetch station summaries
  const { data: stationsResponse, isLoading: stationsLoading } = useStations();

  // Unwrap stations if needed
  const stations: Station[] = stationsResponse?.data ?? extractApiData(stationsResponse, []);

  // Setup Warnings Chain:
  // 1. Check if stations exist
  const primaryStation = stations?.[0];

  // 2. Get fuel prices from global cache instead of making API call
  const queryClient = useQueryClient();
  
  const allFuelPrices = queryClient.getQueryData(['all-fuel-prices', stations?.map(s => s.id).sort().join(',')]);
  console.log('OwnerDashboard allFuelPrices from cache:', allFuelPrices);

  const fuelPricesResponse = useMemo(() => {
    if (!primaryStation?.id) return null;

    if (allFuelPrices && typeof allFuelPrices === 'object') {
      const stationPrices = (allFuelPrices as any)[primaryStation.id];

      if (stationPrices && typeof stationPrices === 'object') {
        // Convert to the expected format
        const current = Object.entries(stationPrices).map(([fuelType, priceData]: [string, any]) => ({
          fuel_type: fuelType,
          price_per_litre: priceData?.price_per_litre || 0,
          fuelType: fuelType,
          pricePerLitre: priceData?.price_per_litre || 0
        }));

        return {
          success: true,
          data: {
            current,
            history: [] // Not needed for this component
          }
        };
      }
    }

    console.warn('OwnerDashboard: No fuel prices found in cache for station:', primaryStation?.id);
    return null;
  }, [primaryStation?.id, stations, allFuelPrices]);

  const hasFuelPrices = (fuelPricesResponse?.data?.current?.length ?? 0) > 0;

  // 3. Fetch pumps for primary station to check if pumps exist AND nozzles are configured
  // This is more accurate than checking the stations response which may not include nozzle details
  const { data: pumpsResponse } = usePumps(primaryStation?.id ?? '');
  
  const hasPumps = (pumpsResponse?.data?.length ?? 0) > 0;

  // 4. Check if any pump has nozzles
  // Nozzles are returned nested within each pump in the pumps response
  const hasNozzles = hasPumps && (pumpsResponse?.data?.some((pump: any) => 
    Array.isArray(pump.nozzles) && pump.nozzles.length > 0
  ) ?? false);

  // Ensure fuel prices are being detected correctly
  if (!hasFuelPrices) {
    console.warn('No fuel prices detected for OwnerDashboard.');
  }

  // Guard: Don't render if not owner
  if (!user || user.role !== 'owner') {
    return null;
  }

  // Note: Pending actions functionality removed as handover concept doesn't exist

  // Defensive: stats may be null/undefined and may not have expected properties
  function isDashboardStats(obj: any): obj is DashboardStats {
    return obj && typeof obj === 'object' &&
      ('totalStations' in obj) && ('totalEmployees' in obj) && ('pendingActions' in obj);
  }

  const safeStats: DashboardStats = isDashboardStats(stats)
    ? stats
    : { totalStations: 0, totalEmployees: 0, pendingActions: 0 };

  const isLoading = statsLoading || stationsLoading;

  return (
    <div 
      className="p-3 sm:p-6 space-y-4 sm:space-y-6 w-full" 
      style={{ minHeight: 'calc(100vh - 4rem)', overflow: 'auto' }}
    >
      {/* Header with Quick Actions */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              Owner Dashboard
            </h1>
          </div>
        </div>
        <QuickActionsGrid navigate={navigate} />
      </div>

      {/* Plan Info Alert */}
      <PlanInfoAlert user={user} stats={{ totalStations: stations.length, totalEmployees: safeStats.totalEmployees }} />

      {/* Setup Warnings - Chain: Stations → Prices → Pumps → Nozzles */}
      <SetupWarningsAlert 
        hasStations={stations.length > 0} 
        hasFuelPrices={hasFuelPrices} 
        hasPumps={hasPumps}
        hasNozzles={hasNozzles}
        navigate={navigate} 
      />

      {/* Stats Grid */}
      <StatsGrid stats={stats ?? null} isLoading={isLoading} />

      {/* Stations Card with List */}
      <StationsCard 
        stations={Array.isArray(stations) ? stations : []} 
        isLoading={isLoading} 
        navigate={navigate} 
      />

      {/* Pending Actions Alert */}
      <PendingActionsAlert stats={{ pendingActions: safeStats.pendingActions ?? 0 }} navigate={navigate} />

      {/* Quick Entry Cards */}
      <QuickEntryCardsGrid navigate={navigate} />
    </div>
  );
}
