import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from "@tanstack/react-query";
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useStations } from '@/hooks/api';
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
import EmployeeDashboard from '@/pages/EmployeeDashboard';
import Settings from '@/pages/Settings';
import AdminUsers from '@/pages/AdminUsers';
import AdminStations from '@/pages/AdminStations';
import MyStations from '@/pages/MyStations';
import Staff from '@/pages/Staff';
import DataEntry from '@/pages/DataEntry';
import QuickDataEntryEnhanced from '@/pages/owner/QuickDataEntryEnhanced';
import EmployeeSalesView from '@/pages/EmployeeSalesView';
import EmployeePumpsView from '@/pages/EmployeePumpsView';
import Sales from '@/pages/Sales';
import Settlements from '@/pages/Settlements';
import Pumps from '@/pages/Pumps';
import Prices from '@/pages/Prices';
import Reports from '@/pages/Reports';
import SampleReadings from '@/pages/SampleReadings';
import AppLayout from '@/components/AppLayout';
import { apiClient } from '@/lib/api-client';
import { safeLower } from '@/lib/stringUtils';
import type { Station } from '@/types/api';
import { CreditLedger } from '@/pages/credit';

// Owner pages
import OwnerDashboard from '@/pages/owner/OwnerDashboard';
import StationsManagement from '@/pages/owner/StationsManagement';
import AddStation from '@/pages/owner/AddStation';
import StationDetail from '@/pages/owner/StationDetail';
import EmployeesManagement from '@/pages/owner/EmployeesManagement';
import OwnerReports from '@/pages/owner/Reports';
import OwnerAnalytics from '@/pages/owner/Analytics';
import IncomeReport from '@/pages/owner/IncomeReport';
import QuickDataEntry from '@/pages/owner/QuickDataEntryEnhanced';
import SettlementStationSelector from '@/pages/owner/SettlementStationSelector';
import DailySettlement from '@/pages/owner/DailySettlement';
import DailySalesReport from '@/pages/owner/DailySalesReport';
import Inventory from '@/pages/owner/Inventory';
import ProfitReports from '@/pages/ProfitReports';

// Cash Management pages
import ShiftManagement from '@/pages/shifts/ShiftManagement';
import CashReconciliationReport from '@/pages/cash/CashReconciliationReport';
import AddCreditor from '@/pages/owner/AddCreditor';

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
    // Role-based redirect after login (check for both new and legacy role formats)
    const normalizedRole = safeLower(user?.role).replace(/\s+/g, '');
    if (normalizedRole === 'superadmin' || normalizedRole === 'super_admin') {
      return <Navigate to="/superadmin/users" replace />;
    }
    if (user.role === 'owner') {
      return <Navigate to="/owner/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function RoleBasedRedirect() {
  const { user, loading } = useAuth();
  
  // Wait for auth to load
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  
  // If no user, send to login (landing)
  if (!user) return <Navigate to="/login" replace />;

  // Check for both new and legacy role naming conventions
  const normalizedRole = safeLower(user?.role).replace(/\s+/g, '');
  if (normalizedRole === 'superadmin' || normalizedRole === 'super_admin') {
    return <Navigate to="/superadmin/users" replace />;
  }

  // Redirect owners to new owner dashboard
  if (user.role === 'owner') {
    return <Navigate to="/owner/dashboard" replace />;
  }

  // Redirect managers to manager dashboard
  if (user.role === 'manager') {
    return <Navigate to="/manager/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

function useStationsForSuperAdmin() {
  const { user } = useAuth();

  // Normalize role to handle legacy formats
  const normalizedRole = safeLower(user?.role).replace(/\s+/g, '');
  const isSuperAdmin = normalizedRole === 'superadmin' || normalizedRole === 'super_admin';

  return useQuery<Station[]>({
    queryKey: ["all-stations"],
    queryFn: async (): Promise<Station[]> => {
      const response = await apiClient.get<Station[]>('/stations');
      return response || [];
    },
    enabled: !!user && isSuperAdmin, // Only run when user is authenticated and is super admin
  });
}

function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Normalize role to handle legacy formats
  const normalizedRole = safeLower(user?.role).replace(/\s+/g, '');
  const isSuperAdmin = normalizedRole === 'superadmin' || normalizedRole === 'super_admin';

  if (!user || !isSuperAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function ManagerOrOwnerRoute({ children }: { children: React.ReactNode }) {
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

  if (user.role !== 'manager' && user.role !== 'owner') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function RoleBasedDataEntry() {
  const { user } = useAuth();

  // All users get the enhanced Quick Entry system (single-step)
  // Station selection is controlled by role within the component
  return <QuickDataEntry />;
}

function RoleBasedSales() {
  const { user } = useAuth();

  // Employees get a read-only sales view
  if (user?.role === 'employee') {
    return <EmployeeSalesView />;
  }

  // Managers and owners get the full Sales management
  return <Sales />;
}

function RoleBasedPumps() {
  const { user } = useAuth();

  // Employees get a read-only pumps view
  if (user?.role === 'employee') {
    return <EmployeePumpsView />;
  }

  // Managers and owners get the full Pumps management
  return <Pumps />;
}

function RoleBasedDashboard() {
  const { user } = useAuth();

  // Employees get the full employee dashboard with shift management
  if (user?.role === 'employee') {
    return <EmployeeDashboard />;
  }

  // Managers and owners get the main dashboard
  return <Dashboard />;
}

function AppContent() {
  const stationsQuery = useStationsForSuperAdmin();

  // Global fuel prices query - runs once for the entire app
  // This prevents multiple API calls when components mount/unmount
  const { user } = useAuth();
  const { data: stationsResponse } = useStations();
  const stations = stationsResponse?.data || [];

  // Pre-fetch all fuel prices for all user's stations
  useQuery({
    queryKey: ['all-fuel-prices', stations?.map(s => s.id).sort().join(',')],
    queryFn: async () => {
      if (!stations || stations.length === 0) {
        return {};
      }

      const allPrices: Record<string, any[]> = {};

      // Fetch prices for all stations in parallel
      await Promise.all(
        stations.map(async (station) => {
          try {
            const url = `/stations/${station.id}/prices`;
            const response = await apiClient.get(url);

            let currentPrices: any[] = [];
            if (response && typeof response === 'object' && 'data' in response) {
              const data = response.data;
              if (data && typeof data === 'object' && 'current' in data && Array.isArray(data.current)) {
                currentPrices = data.current;
              }
            }

            // Transform prices to match the expected format
            const transformed = currentPrices.map((price: any) => ({
              id: price.id,
              station_id: station.id,
              fuel_type: (price.fuelType || '').toString().toUpperCase(),
              fuelType: price.fuelType,
              price_per_litre: price.price,
              pricePerLitre: price.price,
              price: price.price,
              valid_from: price.effectiveFrom,
              created_by: price.createdBy,
              created_at: price.createdAt
            }));

            allPrices[station.id] = transformed;
          } catch (error) {
            console.error(`Failed to fetch prices for station ${station.id}:`, error);
            allPrices[station.id] = [];
          }
        })
      );

      return allPrices;
    },
    enabled: !!user && stations.length > 0, // Only run when user is authenticated and stations are loaded
    staleTime: 5 * 60 * 1000, // 5 minutes - fuel prices typically don't change that often but keep fresh
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes after becoming unused
  });

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RoleBasedRedirect />} />
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

        {/* Super Admin Routes - MUST come BEFORE the catch-all /* route */}
        <Route
          path="/superadmin/*"
          element={
            <SuperAdminGuard>
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
              </SuperAdminGuard>
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
                    <Route path="/dashboard" element={<RoleBasedDashboard />} />
                    
                    {/* Manager Routes - Standardized manager paths */}
                    <Route path="/manager/dashboard" element={<OwnerDashboard />} />
                    <Route path="/manager/quick-entry" element={<QuickDataEntryEnhanced />} />
                    <Route path="/manager/daily-settlement" element={
                      <ManagerOrOwnerRoute>
                        <SettlementStationSelector />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/manager/daily-settlement/:stationId" element={
                      <ManagerOrOwnerRoute>
                        <DailySettlement />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/manager/daily-reports" element={<DailySalesReport />} />
                    <Route path="/manager/stations" element={<StationsManagement />} />
                    <Route path="/manager/stations/add" element={<AddStation />} />
                    <Route path="/manager/stations/:id" element={<StationDetail />} />
                    <Route path="/manager/stations/:id/add-creditor" element={<AddCreditor />} />
                    <Route path="/manager/stations/:id/prices" element={<Prices />} />
                    <Route path="/manager/employees" element={<EmployeesManagement />} />
                    <Route path="/manager/reports" element={<OwnerReports />} />                    <Route path="/manager/sample-readings" element={<SampleReadings />} />                    <Route path="/manager/analytics" element={<OwnerAnalytics />} />
                    <Route path="/manager/income-report" element={<IncomeReport />} />
                    <Route path="/manager/profit-reports" element={<ProfitReports />} />
                    <Route path="/manager/shifts" element={<ShiftManagement />} />
                    <Route path="/manager/cash-report" element={<CashReconciliationReport />} />
                    <Route path="/manager/inventory" element={
                      <ManagerOrOwnerRoute>
                        <Inventory />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/manager/credit-ledger" element={
                      <ManagerOrOwnerRoute>
                        <CreditLedger />
                      </ManagerOrOwnerRoute>
                    } />
                    
                    {/* Owner Routes - New comprehensive UI */}
                    <Route path="/owner/dashboard" element={<OwnerDashboard />} />
                    <Route path="/owner/quick-entry" element={<QuickDataEntryEnhanced />} />
                    <Route path="/owner/daily-settlement" element={
                      <ManagerOrOwnerRoute>
                        <SettlementStationSelector />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/owner/daily-settlement/:stationId" element={
                      <ManagerOrOwnerRoute>
                        <DailySettlement />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/owner/daily-reports" element={<DailySalesReport />} />
                    <Route path="/owner/stations" element={<StationsManagement />} />
                    <Route path="/owner/stations/add" element={<AddStation />} />
                    <Route path="/owner/stations/:id" element={<StationDetail />} />
                    <Route path="/owner/stations/:id/add-creditor" element={<AddCreditor />} />
                    <Route path="/owner/stations/:id/prices" element={<Prices />} />
                    <Route path="/owner/employees" element={<EmployeesManagement />} />
                    <Route path="/owner/reports" element={<OwnerReports />} />
                    <Route path="/owner/sample-readings" element={<SampleReadings />} />
                    <Route path="/owner/analytics" element={<OwnerAnalytics />} />
                    <Route path="/owner/income-report" element={<IncomeReport />} />
                    <Route path="/owner/profit-reports" element={<ProfitReports />} />
                    <Route path="/owner/shifts" element={<ShiftManagement />} />
                    <Route path="/owner/cash-report" element={<CashReconciliationReport />} />
                    <Route path="/owner/inventory" element={
                      <ManagerOrOwnerRoute>
                        <Inventory />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/owner/credit-ledger" element={
                      <ManagerOrOwnerRoute>
                        <CreditLedger />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/credit-ledger" element={
                      <ManagerOrOwnerRoute>
                        <CreditLedger />
                      </ManagerOrOwnerRoute>
                    } />
                    
                    {/* Cash/Shift routes for employees and managers */}
                    <Route path="/shifts" element={<ShiftManagement />} />
                    <Route path="/cash-report" element={<CashReconciliationReport />} />
                    <Route path="/credit-ledger" element={<CreditLedger />} />
                    
                    {/* Employee Quick Entry - replaces old DataEntry */}
                    <Route path="/quick-entry" element={<QuickDataEntryEnhanced />} />
                    {/* Role-based data entry - employees get Quick Entry, managers/owners get full DataEntry */}
                    <Route path="/data-entry" element={<RoleBasedDataEntry />} />
                    <Route path="/sales" element={<RoleBasedSales />} />
                    <Route path="/settlements" element={
                      <ManagerOrOwnerRoute>
                        <Settlements />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/pumps" element={<RoleBasedPumps />} />
                    <Route path="/prices" element={
                      <ManagerOrOwnerRoute>
                        <Prices />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/reports" element={
                      <ManagerOrOwnerRoute>
                        <Reports />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/sample-readings" element={
                      <ManagerOrOwnerRoute>
                        <SampleReadings />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/profit-reports" element={
                      <ManagerOrOwnerRoute>
                        <ProfitReports />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/stations" element={<AdminStations />} />
                    <Route path="/staff" element={<Staff />} />
                    <Route path="/settings" element={<Settings />} />
                    
                    <Route path="/" element={<RoleBasedRedirect />} />
                    {/* Catch-all route for unknown paths - redirects based on auth status */}
                    <Route path="*" element={<RoleBasedRedirect />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            } 
          />
        </Routes>
        <Toaster />
      </Router>
    );
}

export function AppWithQueries() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

// Listen for auth-expired event and redirect to login to ensure clean auth state
window.addEventListener('auth-expired', () => {
  try {
    // Clear the app-specific storage keys used by storage-utils (fuelsync_ prefix)
    localStorage.removeItem('fuelsync_token');
    localStorage.removeItem('fuelsync_user');
  } catch (e) {
    // ignore
  }

  // Only navigate if not already on the login page to avoid reload loops
  try {
    const current = window.location.pathname;
    if (current !== '/login') {
      window.location.href = '/login';
    }
  } catch (e) {
    // fallback to setting location
    window.location.href = '/login';
  }
});
