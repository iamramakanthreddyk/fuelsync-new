/**
 * Manager Dashboard - Station Operations
 * 
 * Minimal view for station managers focused on:
 * - Today's operations (sales, fuel, readings)
 * - Pump status overview
 * 
 * Manager manages single station only
 * Additional features (expenses, reports, inventory) available in sidebar navigation
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { useStations } from '@/hooks/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown, AlertCircle } from 'lucide-react';
import { DateRangeFilterToolbar } from '@/components/DateRangeFilterToolbar';

interface ManagerStats {
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
    pumpNumber: string;
    status: 'active' | 'inactive';
    nozzles: Array<{
      id: string;
      nozzleNumber: number;
      fuelType: string;
      status: 'active' | 'inactive';
    }>;
  }>;
}

const fmt = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function ManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect if not manager
  useEffect(() => {
    if (user && !['manager', 'owner', 'super_admin'].includes(user.role ?? '')) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Get station for current manager
  const stationsResponse = useStations().data;
  const stations = stationsResponse?.success ? stationsResponse.data : [];
  const currentStation = stations[0]; // Manager has 1 station

  // Fetch manager dashboard stats (today's operations)
  const { data: statsResponse, isLoading: statsLoading } = useQuery<{
    success: boolean;
    data: ManagerStats;
  } | null>({
    queryKey: ['manager-dashboard-stats', currentStation?.id],
    queryFn: async () => {
      if (!currentStation?.id) return null;
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: ManagerStats;
        }>(`/stations/${currentStation.id}/dashboard`);
        return response ?? null;
      } catch (error) {
        return null;
      }
    },
    enabled: !!currentStation?.id,
  });

  const stats = statsResponse?.data;
  const activePumps = stats?.pumps?.filter(p => p.status === 'active').length ?? 0;

  return (
    <>
      <div className="container mx-auto p-4 sm:p-6 space-y-4">
        <DateRangeFilterToolbar />
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <TrendingDown className="w-7 h-7 text-blue-600" />
            Station Operations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {currentStation?.name || 'Your Station'} - {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>

        {/* Today's Summary Card */}
        {!statsLoading && stats && (
          <Card className="bg-white border-blue-200 dark:bg-blue-950/20 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                Today's Operations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                {/* Sales */}
                <div className="flex flex-col items-center">
                  <div className="text-xs text-muted-foreground">Sales</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {fmt(stats.today.amount)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{stats.today.litres}L</div>
                </div>

                {/* Cash & Online */}
                <div className="flex flex-col items-center">
                  <div className="text-xs text-muted-foreground">Cash</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {fmt(stats.today.cash)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{fmt(stats.today.online)} online</div>
                </div>

                {/* Readings */}
                <div className="flex flex-col items-center">
                  <div className="text-xs text-muted-foreground">Readings</div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.today.readings}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Pumps active: {activePumps}</div>
                </div>

                {/* Credit Outstanding */}
                <div className="flex flex-col items-center">
                  <div className="text-xs text-muted-foreground">Credit</div>
                  <div className={`text-2xl font-bold ${stats.creditOutstanding > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {fmt(stats.creditOutstanding)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Outstanding</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pumps Status Card */}
        {!statsLoading && stats && stats.pumps && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pump Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.pumps.map(pump => (
                  <div key={pump.id} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                    <div>
                      <div className="font-semibold text-sm">{pump.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {pump.nozzles.length} nozzles - {pump.nozzles.filter(n => n.status === 'active').length} active
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      pump.status === 'active' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {pump.status === 'active' ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
