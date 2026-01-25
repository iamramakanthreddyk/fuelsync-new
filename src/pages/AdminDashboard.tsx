import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { User, Station, Plan } from '@/types/database';
import { Users, Building2, Package, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStations: 0,
    totalOwners: 0,
    totalEmployees: 0,
    activeStations: 0
  });
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [recentStations, setRecentStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);

      // Load all users from REST API
      const usersData = await apiClient.get<User[]>('/users');

      // Load all stations from REST API
      const stationsData = await apiClient.get<Station[]>('/stations');

      // Calculate stats as before...
      const totalUsers = usersData?.length || 0;
      const totalStations = stationsData?.length || 0;
      const totalOwners = usersData?.filter(u => u.role === 'owner').length || 0;
      const totalEmployees = usersData?.filter(u => u.role === 'employee').length || 0;

      setStats({
        totalUsers,
        totalStations,
        totalOwners,
        totalEmployees,
        activeStations: totalStations
      });

      setRecentUsers(usersData || []);
      setRecentStations(stationsData || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadAdminData();
    }
  }, [user, loadAdminData]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            System overview and management
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Across all roles
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStations}</div>
            <p className="text-xs text-muted-foreground">
              Active fuel stations
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Owners</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOwners}</div>
            <p className="text-xs text-muted-foreground">
              Station owners
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              Active employees
            </p>
          </CardContent>
        </Card>
      </div>

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
              {recentUsers.map((user) => (
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
              {recentStations.map((station) => (
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
