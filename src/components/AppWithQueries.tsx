import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from "@tanstack/react-query";
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { RequireRole } from '@/components/RequireRole';
import { SuperAdminLayout } from '@/layouts/SuperAdminLayout';
import { 
  UsersPage, 
  StationsPage, 
  PumpsPage, 
  PlansPage, 
  AnalyticsPage, 
  CreateOwnerWizard 
} from '@/pages/SuperAdmin';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Dashboard from '@/pages/Dashboard';
import Settings from '@/pages/Settings';
import AdminUsers from '@/pages/AdminUsers';
import AdminStations from '@/pages/AdminStations';
import MyStations from '@/pages/MyStations';
import Staff from '@/pages/Staff';
import DataEntry from '@/pages/DataEntry'; // UPDATED: use DataEntry
import Sales from '@/pages/Sales';
import DailyClosure from '@/pages/DailyClosure';
import Pumps from '@/pages/Pumps';
import Prices from '@/pages/Prices';
import Reports from '@/pages/Reports';
import AppLayout from '@/components/AppLayout';
import { apiClient } from '@/lib/api-client';
import type { Station } from '@/types/api';

// Owner pages
import OwnerDashboard from '@/pages/owner/OwnerDashboard';
import StationsManagement from '@/pages/owner/StationsManagement';
import StationDetail from '@/pages/owner/StationDetail';
import EmployeesManagement from '@/pages/owner/EmployeesManagement';
import OwnerReports from '@/pages/owner/Reports';
import OwnerAnalytics from '@/pages/owner/Analytics';
import QuickDataEntry from '@/pages/owner/QuickDataEntry';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (user) {
    // Role-based redirect after login
    if (user.role === 'super_admin') {
      return <Navigate to="/superadmin/users" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function RoleBasedRedirect() {
  const { user } = useAuth();
  
  if (user?.role === 'super_admin') {
    return <Navigate to="/superadmin/users" replace />;
  }
  
  // Redirect owners to new owner dashboard
  if (user?.role === 'owner') {
    return <Navigate to="/owner/dashboard" replace />;
  }
  
  return <Navigate to="/dashboard" replace />;
}

function useStationsForSuperAdmin() {
  return useQuery<Station[]>({
    queryKey: ["all-stations"],
    queryFn: async (): Promise<Station[]> => {
      const response = await apiClient.get<Station[]>('/stations');
      console.log('🏢 All stations response:', response);
      return response || [];
    }
  });
}

export function AppWithQueries() {
  const stationsQuery = useStationsForSuperAdmin();

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          <Route 
            path="/signup" 
            element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            }
          />
          
          {/* Super Admin Routes - Completely separate from owner/employee routes */}
          <Route 
            path="/superadmin/*" 
            element={
              <ProtectedRoute>
                <RequireRole role="superadmin">
                  <SuperAdminLayout>
                    <Routes>
                      <Route
                        path="/users"
                        element={
                          stationsQuery.isLoading
                            ? (
                                <div className="flex items-center justify-center min-h-screen">Loading stations…</div>
                              )
                            : (
                                <UsersPage stations={stationsQuery.data || []} />
                              )
                        }
                      />
                      <Route path="/stations" element={<StationsPage />} />
                      <Route path="/pumps" element={<PumpsPage />} />
                      <Route path="/plans" element={<PlansPage />} />
                      <Route path="/analytics" element={<AnalyticsPage />} />
                      <Route path="/create-owner" element={<CreateOwnerWizard />} />
                      <Route path="/" element={<Navigate to="/superadmin/users" replace />} />
                    </Routes>
                  </SuperAdminLayout>
                </RequireRole>
              </ProtectedRoute>
            } 
          />
          
          {/* Regular App Routes - For owners and employees only */}
          <Route 
            path="/*" 
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    {/* Default dashboard for managers/employees */}
                    <Route path="/dashboard" element={<Dashboard />} />
                    
                    {/* Owner Routes - New comprehensive UI */}
                    <Route path="/owner/dashboard" element={<OwnerDashboard />} />
                    <Route path="/owner/quick-entry" element={<QuickDataEntry />} />
                    <Route path="/owner/stations" element={<StationsManagement />} />
                    <Route path="/owner/stations/:id" element={<StationDetail />} />
                    <Route path="/owner/employees" element={<EmployeesManagement />} />
                    <Route path="/owner/reports" element={<OwnerReports />} />
                    <Route path="/owner/analytics" element={<OwnerAnalytics />} />
                    
                    {/* Legacy routes - keep for backward compatibility */}
                    <Route path="/stations" element={<MyStations />} />
                    
                    {/* CHANGED: Use /data-entry route instead of /upload */}
                    <Route path="/data-entry" element={<DataEntry />} />
                    <Route path="/sales" element={<Sales />} />
                    <Route path="/daily-closure" element={<DailyClosure />} />
                    <Route path="/pumps" element={<Pumps />} />
                    <Route path="/prices" element={<Prices />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/stations" element={<AdminStations />} />
                    <Route path="/staff" element={<Staff />} />
                    <Route path="/settings" element={<Settings />} />
                    {/* Optionally: for backward compatibility, can also keep /upload as DataEntry */}
                    <Route path="/upload" element={<DataEntry />} />
                    
                    <Route path="/" element={<RoleBasedRedirect />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            } 
          />
        </Routes>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}
