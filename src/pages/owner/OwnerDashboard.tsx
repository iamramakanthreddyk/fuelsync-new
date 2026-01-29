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

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { extractApiData } from '@/lib/api-response';
import { useStations, usePumps, useFuelPrices } from '@/hooks/api';
import { useVarianceSummary } from '@/hooks/useVarianceSummary';
import { safeToFixed } from '@/lib/format-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
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
        }>(`/analytics/owner/stats${user?.id ? `?ownerId=${user.id}` : ''}`);
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

  // Fetch fuel prices for primary station
  const { data: fuelPricesResponse } = useFuelPrices(primaryStation?.id ?? '');

  // Variance tracking
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [varianceStartDate] = useState(firstDayOfMonth);
  const [varianceEndDate] = useState(today);

  const { data: varianceSummary } = useVarianceSummary(
    primaryStation?.id,
    varianceStartDate,
    varianceEndDate
  );

  // Extract fuel prices data (same pattern as stations)
  const fuelPricesData = fuelPricesResponse?.data ?? extractApiData(fuelPricesResponse, { current: [], history: [] });

  const hasFuelPrices = (fuelPricesData?.current?.length ?? 0) > 0;

  // Debug logging removed for production UI

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
  // Runtime warnings removed from UI

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

      {/* Variance Card - Compact Design */}
      {varianceSummary && (
        <Card className={`border-l-4 ${
          varianceSummary.totalVariance > 0 ? 'border-l-red-500 bg-red-50/50' :
          varianceSummary.totalVariance < 0 ? 'border-l-yellow-500 bg-yellow-50/50' :
          'border-l-green-500 bg-green-50/50'
        }`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-4 h-4 ${
                  varianceSummary.totalVariance > 0 ? 'text-red-600' :
                  varianceSummary.totalVariance < 0 ? 'text-yellow-600' :
                  'text-green-600'
                }`} />
                <span className="text-sm font-medium text-muted-foreground">Monthly Variance</span>
              </div>
              <div className={`text-right ${
                varianceSummary.totalVariance > 0 ? 'text-red-700' :
                varianceSummary.totalVariance < 0 ? 'text-yellow-700' :
                'text-green-700'
              }`}>
                <div className="text-lg font-bold">
                  {varianceSummary.totalVariance > 0 ? '-' : varianceSummary.totalVariance < 0 ? '+' : ''}
                  ₹{Math.abs(varianceSummary.totalVariance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {safeToFixed(Math.abs(varianceSummary.variancePercentage), 1)}% of sales
                </div>
              </div>
            </div>

            {/* Status indicator - subtle */}
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                varianceSummary.totalVariance > 0 ? 'bg-red-100 text-red-800' :
                varianceSummary.totalVariance < 0 ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {varianceSummary.totalVariance > 0 ? 'Shortfall' :
                 varianceSummary.totalVariance < 0 ? 'Overage' :
                 'Balanced'}
              </span>
              <span className="text-muted-foreground">
                {varianceSummary.dayCount} days
              </span>
            </div>
          </CardContent>
        </Card>
      )}

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
