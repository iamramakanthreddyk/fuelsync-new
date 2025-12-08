import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from "@tanstack/react-query";
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
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
import DataEntry from '@/pages/DataEntry';
import EmployeeQuickEntry from '@/pages/EmployeeQuickEntry';
import EmployeeSalesView from '@/pages/EmployeeSalesView';
import EmployeePumpsView from '@/pages/EmployeePumpsView';
import Sales from '@/pages/Sales';
import DailyClosure from '@/pages/DailyClosure';
import Pumps from '@/pages/Pumps';
import Prices from '@/pages/Prices';
import Reports from '@/pages/Reports';
import AppLayout from '@/components/AppLayout';
import { apiClient } from '@/lib/api-client';
import type { Station } from '@/types/api';
import { ReadingApprovalList } from '@/pages/readings';
import { CreditLedger } from '@/pages/credit';

// Owner pages
import OwnerDashboard from '@/pages/owner/OwnerDashboard';
import StationsManagement from '@/pages/owner/StationsManagement';
import StationDetail from '@/pages/owner/StationDetail';
import EmployeesManagement from '@/pages/owner/EmployeesManagement';
import OwnerReports from '@/pages/owner/Reports';
import OwnerAnalytics from '@/pages/owner/Analytics';
import QuickDataEntry from '@/pages/owner/QuickDataEntryEnhanced';
import SettlementStationSelector from '@/pages/owner/SettlementStationSelector';
import DailySettlement from '@/pages/owner/DailySettlement';
import DailySalesReport from '@/pages/owner/DailySalesReport';

// Cash Management pages
import ShiftManagement from '@/pages/shifts/ShiftManagement';
import CashHandoverConfirmation from '@/pages/cash/CashHandoverConfirmation';
import CashReconciliationReport from '@/pages/cash/CashReconciliationReport';

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
    const normalizedRole = typeof user.role === 'string' && user.role.replace(/\s+/g, '').toLowerCase();
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
  const normalizedRole = typeof user.role === 'string' && user.role.replace(/\s+/g, '').toLowerCase();
  if (normalizedRole === 'superadmin' || normalizedRole === 'super_admin') {
    return <Navigate to="/superadmin/users" replace />;
  }

  // Redirect owners to new owner dashboard
  if (user.role === 'owner') {
    return <Navigate to="/owner/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

function useStationsForSuperAdmin() {
  const { user } = useAuth();

  // Normalize role to handle legacy formats
  const normalizedRole = typeof user?.role === 'string' && user.role.replace(/\s+/g, '').toLowerCase();
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
  const normalizedRole = typeof user?.role === 'string' && user.role.replace(/\s+/g, '').toLowerCase();
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
  
  // Employees get the simplified Quick Entry
  if (user?.role === 'employee') {
    return <EmployeeQuickEntry />;
  }
  
  // Managers and owners get the full DataEntry (with tabs)
  return <DataEntry />;
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

function AppContent() {
  const stationsQuery = useStationsForSuperAdmin();

  return (
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
                    <Route path="/dashboard" element={<Dashboard />} />
                    
                    {/* Owner Routes - New comprehensive UI */}
                    <Route path="/owner/dashboard" element={<OwnerDashboard />} />
                    <Route path="/owner/quick-entry" element={<QuickDataEntry />} />
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
                    <Route path="/owner/stations/:id" element={<StationDetail />} />
                    <Route path="/owner/stations/:id/prices" element={<Prices />} />
                    <Route path="/owner/employees" element={<EmployeesManagement />} />
                    <Route path="/owner/reports" element={<OwnerReports />} />
                    <Route path="/owner/analytics" element={<OwnerAnalytics />} />
                    <Route path="/owner/shifts" element={<ShiftManagement />} />
                    <Route path="/owner/cash-handovers" element={<CashHandoverConfirmation />} />
                    <Route path="/owner/cash-report" element={<CashReconciliationReport />} />
                    <Route path="/owner/reading-approvals" element={
                      <ManagerOrOwnerRoute>
                        <ReadingApprovalList />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/reading-approvals" element={
                      <ManagerOrOwnerRoute>
                        <ReadingApprovalList />
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
                    <Route path="/owner/cash-handovers" element={
                      <ManagerOrOwnerRoute>
                        <CashHandoverConfirmation />
                      </ManagerOrOwnerRoute>
                    } />
                    <Route path="/cash-handovers" element={
                      <ManagerOrOwnerRoute>
                        <CashHandoverConfirmation />
                      </ManagerOrOwnerRoute>
                    } />
                    
                    {/* Cash/Shift routes for employees and managers */}
                    <Route path="/shifts" element={<ShiftManagement />} />
                    <Route path="/cash-handovers" element={<CashHandoverConfirmation />} />
                    <Route path="/cash-report" element={<CashReconciliationReport />} />
                    <Route path="/reading-approvals" element={<ReadingApprovalList />} />
                    <Route path="/credit-ledger" element={<CreditLedger />} />
                    
                    {/* Employee Quick Entry - replaces old DataEntry */}
                    <Route path="/quick-entry" element={<EmployeeQuickEntry />} />
                    {/* Role-based data entry - employees get Quick Entry, managers/owners get full DataEntry */}
                    <Route path="/data-entry" element={<RoleBasedDataEntry />} />
                    <Route path="/sales" element={<RoleBasedSales />} />
                    <Route path="/daily-closure" element={
                      <ManagerOrOwnerRoute>
                        <DailyClosure />
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
