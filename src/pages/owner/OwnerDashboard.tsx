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
import { dashboardAlertsService } from '@/services/tenderService';
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
    queryKey: ['owner-dashboard-stats'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: DashboardStats;
        }>('/dashboard/owner/stats');
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

  // 2. Fetch fuel prices for primary station (only if station exists)
  const { data: fuelPricesResponse } = useQuery<{
    success: boolean;
    data: { current: any[]; history: any[] };
  } | null>({
    queryKey: ['fuel-prices', primaryStation?.id],
    queryFn: async () => {
      if (!primaryStation?.id) return null;
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: { current: any[]; history: any[] };
        }>(`/stations/${primaryStation.id}/prices`);
        return response ?? null;
      } catch (error) {
        return null;
      }
    },
    enabled: !!user && !!primaryStation?.id
  });

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

  // Guard: Don't render if not owner
  if (!user || user.role !== 'owner') {
    return null;
  }

  // Fetch pending handovers alert for owner (used to show reconcile banner)
  const { data: pendingAlert } = useQuery({
    queryKey: ['owner-pending-handovers-alert'],
    queryFn: () => dashboardAlertsService.getPendingHandoversAlert(),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const showReconcileBanner = (pendingAlert?.pendingCount ?? 0) > 0;

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
      className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl" 
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

        {showReconcileBanner && (
          <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Daily Reconciliation</h3>
                <p className="text-sm text-muted-foreground">You have {pendingAlert?.pendingCount || 0} pending handover(s) to confirm.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-primary px-4 py-2 rounded bg-yellow-600 text-white"
                  onClick={() => navigate('/owner/cash-handovers')}
                >
                  Go To Reconcile
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Plan Info Alert */}
      <PlanInfoAlert user={user} stats={{ totalStations: safeStats.totalStations, totalEmployees: safeStats.totalEmployees }} />

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
