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

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { extractApiData } from '@/lib/api-response';
import { useStations, usePumps } from '@/hooks/api';
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

  // 2. Get fuel prices from global cache instead of making API call
  const queryClient = useQueryClient();
  
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

  const allFuelPrices = queryClient.getQueryData(['all-fuel-prices', stations?.map(s => s.id).sort().join(',')]);

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

      {/* Variance Card */}
      {varianceSummary && (
        <Card className={`border-2 ${
          varianceSummary.totalVariance > 0 ? 'border-red-300 bg-red-50' :
          varianceSummary.totalVariance < 0 ? 'border-yellow-300 bg-yellow-50' :
          'border-green-200 bg-green-50'
        }`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <AlertCircle className={`w-5 h-5 ${
                varianceSummary.totalVariance > 0 ? 'text-red-600' :
                varianceSummary.totalVariance < 0 ? 'text-yellow-600' :
                'text-green-600'
              }`} />
              Monthly Variance
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">{varianceStartDate} to {varianceEndDate}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <div className="text-xs text-muted-foreground font-bold">
                  {varianceSummary.totalVariance > 0 ? '🚨 SHORTFALL' : varianceSummary.totalVariance < 0 ? '⚠️ OVERAGE' : '✓ BALANCED'}
                </div>
                <div className={`text-lg sm:text-2xl font-bold ${
                  varianceSummary.totalVariance > 0 ? 'text-red-700' :
                  varianceSummary.totalVariance < 0 ? 'text-yellow-700' :
                  'text-green-700'
                }`}>
                  ₹{Math.abs(varianceSummary.totalVariance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-bold">% OF SALES</div>
                <div className={`text-lg sm:text-2xl font-bold ${
                  Math.abs(varianceSummary.variancePercentage) > 3 ? 'text-red-700' :
                  Math.abs(varianceSummary.variancePercentage) > 1 ? 'text-yellow-700' :
                  'text-green-700'
                }`}>
                  {safeToFixed(Math.abs(varianceSummary.variancePercentage), 2)}%
                </div>
              </div>
            </div>

            {/* Meaning explanation */}
            <div className={`p-2 rounded text-xs font-medium ${
              varianceSummary.totalVariance > 0 ? 'bg-red-100 text-red-800' :
              varianceSummary.totalVariance < 0 ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {varianceSummary.totalVariance > 0 
                ? `⚠️ Expected ₹${safeToFixed(varianceSummary.totalExpectedCash, 0)} but received ₹${safeToFixed(varianceSummary.totalExpectedCash - varianceSummary.totalVariance, 0)} - MISSING CASH`
                : varianceSummary.totalVariance < 0
                ? `📊 Received ₹${safeToFixed(varianceSummary.totalExpectedCash - varianceSummary.totalVariance, 0)} but expected ₹${safeToFixed(varianceSummary.totalExpectedCash, 0)} - EXTRA CASH`
                : `✓ Received exactly what was expected`
              }
            </div>

            {/* Status badge */}
            <Badge className={`w-full justify-center py-1.5 text-xs sm:text-sm font-bold ${
              varianceSummary.summary.status === 'HEALTHY' ? 'bg-green-600 text-white' :
              varianceSummary.summary.status === 'REVIEW' ? 'bg-yellow-600 text-white' :
              'bg-red-600 text-white'
            }`}>
              {varianceSummary.summary.status === 'INVESTIGATE' ? '🚨 INVESTIGATE' :
               varianceSummary.summary.status === 'REVIEW' ? '⚠️ REVIEW' :
               '✓ HEALTHY'}
            </Badge>

            <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2">
              <div>
                <span className="text-muted-foreground">Days:</span>
                <span className="font-bold ml-1">{varianceSummary.dayCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Avg/Day:</span>
                <span className="font-bold ml-1">₹{Math.abs(varianceSummary.avgDailyVariance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
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
