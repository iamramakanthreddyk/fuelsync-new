import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { User, Station } from '@/types/database';

export interface AdminStats {
  totalUsers: number;
  totalStations: number;
  totalOwners: number;
  totalEmployees: number;
  activeStations: number;
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const [usersRes, stationsRes] = await Promise.all([
        apiClient.get<User[]>('/users'),
        apiClient.get<Station[]>('/stations')
      ]);

      const users = Array.isArray(usersRes) ? usersRes : ((usersRes as any)?.data || []);
      const stations = Array.isArray(stationsRes) ? stationsRes : ((stationsRes as any)?.data || []);

      const stats: AdminStats = {
        totalUsers: users.length,
        totalStations: stations.length,
        totalOwners: users.filter((u: User) => u.role === 'owner').length,
        totalEmployees: users.filter((u: User) => u.role === 'employee').length,
        activeStations: stations.length
      };

      return {
        stats,
        recentUsers: users.slice(-5), // Last 5 users
        recentStations: stations.slice(-5), // Last 5 stations
        allUsers: users,
        allStations: stations
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useOwnerDashboard(stationId?: string) {
  return useQuery({
    queryKey: ['owner-dashboard', stationId],
    queryFn: async () => {
      if (!stationId) return null;

      const [employeesRes, pumpsRes] = await Promise.all([
        apiClient.get(`/stations/${stationId}/employees`),
        apiClient.get(`/stations/${stationId}/pumps`)
      ]);

      return {
        employees: Array.isArray(employeesRes) ? employeesRes : ((employeesRes as any)?.data || []),
        pumps: Array.isArray(pumpsRes) ? pumpsRes : ((pumpsRes as any)?.data || []),
        stationId
      };
    },
    enabled: !!stationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useEmployeeDashboard(stationId?: string) {
  return useQuery({
    queryKey: ['employee-dashboard', stationId],
    queryFn: async () => {
      if (!stationId) return null;

      const [shiftRes, readingsRes] = await Promise.all([
        apiClient.get(`/shifts/active`),
        apiClient.get(`/readings/today?stationId=${stationId}`)
      ]);

      return {
        activeShift: (shiftRes as any)?.data?.shift || (shiftRes as any)?.shift || null,
        todayReadings: Array.isArray(readingsRes) ? readingsRes : ((readingsRes as any)?.data || []),
        stationId
      };
    },
    enabled: !!stationId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
}