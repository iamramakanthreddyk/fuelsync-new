import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { User, Station, Plan } from '@/types/database';
import { Users, Building2, Package, TrendingUp } from 'lucide-react';
import { useAdminDashboard } from '@/hooks/useDashboardQueries';
import { DashboardHeader, MetricCard, DashboardGrid, COMMON_METRICS } from '@/components/dashboard/shared';
import { RoleBadge } from '@/components/ui/RoleBadge';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, isLoading, error } = useAdminDashboard();

  if (user?.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">Only super admins can access this dashboard</p>
        </div>
      </div>
    );
  }

  if (error) {
    toast({
      title: 'Error',
      description: 'Failed to load dashboard data',
      variant: 'destructive'
    });
  }

  const stats = data?.stats || {
    totalUsers: 0,
    totalStations: 0,
    totalOwners: 0,
    totalEmployees: 0,
    activeStations: 0
  };

  const metrics = [
    {
      ...COMMON_METRICS.users,
      value: stats.totalUsers.toString(),
      description: "Across all roles"
    },
    {
      ...COMMON_METRICS.stations,
      value: stats.totalStations.toString(),
      description: "Active fuel stations"
    },
    {
      title: "Total Owners",
      icon: <Users className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'purple' as const,
      value: stats.totalOwners.toString(),
      description: "Station owners"
    },
    {
      title: "Total Employees",
      icon: <Users className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'orange' as const,
      value: stats.totalEmployees.toString(),
      description: "Active employees"
    }
  ];

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Admin Dashboard"
        subtitle="System overview and management"
        rightContent={<RoleBadge role="super_admin" size="md" />}
      />

      {/* Overview Cards */}
      <DashboardGrid metrics={metrics} />

      {/* Recent Users */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Users</CardTitle>
          <CardDescription>
            Latest user registrations in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.recentUsers?.slice(0, 5).map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Stations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Stations</CardTitle>
          <CardDescription>
            Latest stations added to the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.recentStations?.slice(0, 5).map((station) => (
                <TableRow key={station.id}>
                  <TableCell className="font-medium">{station.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{station.brand}</Badge>
                  </TableCell>
                  <TableCell>{station.address}</TableCell>
                  <TableCell>
                    <Badge variant="default">Active</Badge>
                  </TableCell>
                  <TableCell>{new Date(station.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
