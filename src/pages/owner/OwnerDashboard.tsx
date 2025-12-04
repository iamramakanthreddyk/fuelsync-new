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
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { extractApiData } from '@/lib/api-response';
import { useStations } from '@/hooks/api';
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
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats | null>({
    queryKey: ['owner-dashboard-stats'],
    queryFn: async () => {
      const response = await apiClient.get<DashboardStats | null>('/dashboard/owner/stats');
      return response ?? null;
    },
    enabled: !!user
  });

  // Fetch station summaries
  const { data: stationsResponse, isLoading: stationsLoading } = useStations();

  // Unwrap stations if needed
  const stations: Station[] = stationsResponse?.data ?? extractApiData(stationsResponse, []);

  // Fetch fuel prices to check if they're set
  const { data: fuelPricesResponse } = useQuery<{
    success: boolean;
    data: { current: any[]; history: any[] };
  } | null>({
    queryKey: ['fuel-prices'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: { current: any[]; history: any[] };
        }>('/fuel-prices');
        return response ?? null;
      } catch (error) {
        return null;
      }
    },
    enabled: !!user && stations.length > 0
  });

  const hasFuelPrices = (fuelPricesResponse?.data?.current?.length ?? 0) > 0;

  // Guard: Don't render if not owner
  if (!user || user.role !== 'owner') {
    return null;
  }

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
      </div>

      {/* Plan Info Alert */}
      <PlanInfoAlert user={user} stats={{ totalStations: safeStats.totalStations, totalEmployees: safeStats.totalEmployees }} />

      {/* Setup Warnings */}
      <SetupWarningsAlert hasStations={stations.length > 0} hasFuelPrices={hasFuelPrices} navigate={navigate} />

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
