/**
 * Owner Dashboard - Main Overview
 * Displays station metrics, quick actions, and recent activity
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { 
  Building2, 
  Users, 
  Fuel, 
  DollarSign, 
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Settings,
  BarChart3,
  Activity,
  CheckCircle2,
  Clock,
  Zap,
  Bell
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DashboardStats {
  totalStations: number;
  activeStations: number;
  totalEmployees: number;
  todaySales: number;
  monthSales: number;
  pendingActions: number;
}

interface StationSummary {
  id: string;
  name: string;
  code: string;
  pumpCount: number;
  activePumps: number;
  todaySales: number;
  lastReading: string | null;
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
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['owner-dashboard-stats'],
    queryFn: async () => {
      const response = await apiClient.get<DashboardStats>('/dashboard/owner/stats');
      return response;
    },
    enabled: !!user
  });

  // Fetch station summaries
  const { data: stations, isLoading: stationsLoading } = useQuery({
    queryKey: ['owner-stations-summary'],
    queryFn: async () => {
      const response = await apiClient.get<StationSummary[]>('/stations');
      return response;
    },
    enabled: !!user
  });

  if (!user || user.role !== 'owner') {
    return null;
  }

  const isLoading = statsLoading || stationsLoading;

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const calculateProgress = (current: number, max: number) => Math.min((current / max) * 100, 100);

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl" style={{ minHeight: 'calc(100vh - 4rem)', overflow: 'auto' }}>
      {/* Header - Mobile Optimized */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              Owner Dashboard
            </h1>
          </div>
          <Button 
            onClick={() => navigate('/owner/analytics')} 
            variant="default"
            size="sm" 
            className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Analytics</span>
            <span className="sm:hidden">Charts</span>
          </Button>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => navigate('/owner/stations')} 
            variant="outline" 
            size="sm"
            className="border-primary/20 hover:bg-primary/5"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Stations
          </Button>
          <Button 
            onClick={() => navigate('/owner/employees')} 
            variant="outline" 
            size="sm"
            className="border-primary/20 hover:bg-primary/5"
          >
            <Users className="w-4 h-4 mr-2" />
            Employees
          </Button>
          <Button 
            onClick={() => navigate('/owner/reports')} 
            variant="outline" 
            size="sm"
            className="border-primary/20 hover:bg-primary/5"
          >
            <Fuel className="w-4 h-4 mr-2" />
            Reports
          </Button>
        </div>
      </div>

      {/* Plan Info Alert - Enhanced */}
      {user.plan && (
        <Alert className="border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
          <Zap className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <AlertDescription className="text-xs sm:text-sm flex items-center justify-between flex-wrap gap-2">
            <div>
              <Badge variant="secondary" className="mr-2 bg-blue-600 text-white">
                {user.plan.name}
              </Badge>
              <span className="text-muted-foreground">
                {stats?.totalStations || 0}/{user.plan.maxStations} stations • 
                {user.plan.maxPumpsPerStation} pumps/station • 
                {stats?.totalEmployees || 0} employees
              </span>
            </div>
            {stats && user.plan.maxStations && (
              <div className="flex items-center gap-2">
                <Progress 
                  value={calculateProgress(stats.totalStations, user.plan.maxStations)} 
                  className="w-20 h-2"
                />
                <span className="text-xs text-muted-foreground">
                  {calculateProgress(stats.totalStations, user.plan.maxStations).toFixed(0)}%
                </span>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid - Enhanced with Icons & Colors */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Stations</CardTitle>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
              {isLoading ? '...' : stats?.totalStations || 0}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {isLoading ? '...' : stats?.activeStations || 0} active
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Employees</CardTitle>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
              {isLoading ? '...' : stats?.totalEmployees || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all stations
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500 bg-gradient-to-br from-green-50/50 to-transparent dark:from-green-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Today's Sales</CardTitle>
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400 truncate">
              {isLoading ? '...' : formatCurrency(stats?.todaySales || 0)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Activity className="w-3 h-3" />
              <span>Combined total</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50/50 to-transparent dark:from-orange-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Month Sales</CardTitle>
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400 truncate">
              {isLoading ? '...' : formatCurrency(stats?.monthSales || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Current month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stations List - Enhanced */}
      <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-primary">
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <CardTitle className="text-base sm:text-lg">Your Stations</CardTitle>
                {stations && stations.length > 0 && (
                  <Badge variant="secondary">{stations.length}</Badge>
                )}
              </div>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Performance overview
              </CardDescription>
            </div>
            <Button 
              onClick={() => navigate('/owner/stations')} 
              size="sm" 
              className="flex-shrink-0"
              variant="outline"
            >
              <span className="hidden sm:inline">View All</span>
              <span className="sm:hidden">All</span>
              <ArrowRight className="w-4 h-4 ml-1 sm:ml-2" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3"></div>
              <p className="text-sm text-muted-foreground">Loading stations...</p>
            </div>
          ) : stations && stations.length > 0 ? (
            <div className="space-y-3">
              {stations.map((station, idx) => {
                const pumpUtilization = station.pumpCount > 0 
                  ? (station.activePumps / station.pumpCount) * 100 
                  : 0;
                
                return (
                  <div
                    key={station.id}
                    className="group flex items-start sm:items-center justify-between p-3 sm:p-4 border-2 rounded-xl hover:border-primary/50 hover:shadow-md cursor-pointer transition-all duration-300 bg-gradient-to-r hover:from-primary/5 hover:to-transparent"
                    onClick={() => navigate(`/owner/stations/${station.id}`)}
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div className="relative">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        {idx === 0 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">★</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm sm:text-base truncate">
                            {station.name}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            {station.code || 'N/A'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Activity className="w-3 h-3" />
                            <span>
                              {station.activePumps}/{station.pumpCount} pumps
                            </span>
                          </div>
                          {station.lastReading && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>Last: {new Date(station.lastReading).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        <div className="w-full max-w-[200px]">
                          <Progress 
                            value={pumpUtilization} 
                            className="h-1.5"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <div className="space-y-1">
                        <p className="font-bold text-base sm:text-lg bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                          {formatCurrency(station.todaySales || 0)}
                        </p>
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          <span className="hidden sm:inline">Today</span>
                          <span className="sm:hidden">TD</span>
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">No stations yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Get started by adding your first fuel station
                </p>
                <Button onClick={() => navigate('/owner/stations')} size="sm">
                  <Building2 className="w-4 h-4 mr-2" />
                  Add Your First Station
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Actions Alert */}
      {stats && stats.pendingActions > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <Bell className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>
                You have <strong>{stats.pendingActions}</strong> pending action{stats.pendingActions > 1 ? 's' : ''} that need attention
              </span>
              <Button size="sm" variant="outline" onClick={() => navigate('/owner/stations')}>
                Review
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Actions - Enhanced */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card 
          className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-yellow-500/50 bg-gradient-to-br from-yellow-50/50 to-transparent dark:from-yellow-950/20" 
          onClick={() => navigate('/owner/quick-entry')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-base sm:text-lg group-hover:text-yellow-600 transition-colors">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <span>Quick Entry</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Fast nozzle reading entry for today
            </p>
            <div className="mt-3 flex items-center text-xs text-yellow-600 font-medium">
              <span>Enter now</span>
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20" 
          onClick={() => navigate('/owner/stations')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-base sm:text-lg group-hover:text-primary transition-colors">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span>Manage Stations</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Add, edit, and configure your fuel stations
            </p>
            <div className="mt-3 flex items-center text-xs text-primary font-medium">
              <span>Get started</span>
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20" 
          onClick={() => navigate('/owner/employees')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-base sm:text-lg group-hover:text-primary transition-colors">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span>Manage Employees</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Add and manage staff across all stations
            </p>
            <div className="mt-3 flex items-center text-xs text-primary font-medium">
              <span>View team</span>
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50 bg-gradient-to-br from-green-50/50 to-transparent dark:from-green-950/20" 
          onClick={() => navigate('/owner/reports')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-base sm:text-lg group-hover:text-primary transition-colors">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:scale-110 transition-transform">
                <BarChart3 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <span>View Reports</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Sales, profit/loss, and analytics reports
            </p>
            <div className="mt-3 flex items-center text-xs text-primary font-medium">
              <span>See insights</span>
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
