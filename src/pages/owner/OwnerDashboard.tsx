/**
 * Owner Dashboard - Main Overview
 * Displays station metrics, quick actions, and recent activity
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  BarChart3
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Owner Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/owner/analytics')} variant="outline">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </Button>
          <Button onClick={() => navigate('/owner/stations')}>
            <Building2 className="w-4 h-4 mr-2" />
            Manage Stations
          </Button>
        </div>
      </div>

      {/* Plan Info Alert */}
      {user.plan && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Current Plan: <strong>{user.plan.name}</strong> - 
            Max {user.plan.maxStations} stations, {user.plan.maxPumpsPerStation} pumps per station
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats?.totalStations || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? '...' : stats?.activeStations || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats?.totalEmployees || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all stations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{isLoading ? '...' : (stats?.todaySales || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              All stations combined
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Month Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{isLoading ? '...' : (stats?.monthSales || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Current month total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stations List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Stations</CardTitle>
              <CardDescription>Quick overview of all stations</CardDescription>
            </div>
            <Button onClick={() => navigate('/owner/stations')}>
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading stations...
            </div>
          ) : stations && stations.length > 0 ? (
            <div className="space-y-4">
              {stations.map((station) => (
                <div
                  key={station.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => navigate(`/owner/stations/${station.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <Building2 className="w-8 h-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">{station.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Code: {station.code || 'N/A'} • {station.activePumps}/{station.pumpCount} pumps active
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">₹{(station.todaySales || 0).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Today's sales</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No stations yet</p>
              <Button onClick={() => navigate('/owner/stations')}>
                Add Your First Station
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:bg-accent" onClick={() => navigate('/owner/stations')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Manage Stations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Add, edit, and configure your fuel stations
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent" onClick={() => navigate('/owner/employees')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Manage Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Add and manage staff across all stations
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent" onClick={() => navigate('/owner/reports')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fuel className="w-5 h-5" />
              View Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sales, profit/loss, and analytics reports
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
