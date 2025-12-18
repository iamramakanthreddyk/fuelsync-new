import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { IndianRupee, TrendingUp, Clock, AlertTriangle, Lock } from "lucide-react";
import { TrendsChart } from "@/components/dashboard/TrendsChart";
import { FuelPriceCard } from "@/components/dashboard/FuelPriceCard";
import { AlertBadges } from "@/components/dashboard/AlertBadges";
import { useDashboardData } from "@/hooks/useDashboardData";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";
import { useState, useEffect } from "react";
import { getBasePath } from '@/lib/roleUtils';
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useFuelPricesData, normalizeFuelType } from "@/hooks/useFuelPricesData";
import { useFuelPricesGlobal } from "../context/FuelPricesContext";
import { Button } from "@/components/ui/button";
import { useRoleAccess } from "@/hooks/useRoleAccess";

import { useSetupChecklist } from "@/hooks/useSetupChecklist";

import { SetupChecklist } from "@/components/dashboard/SetupChecklist";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ReadingSummary } from "@/components/dashboard/ReadingSummary";
import { safeToFixed } from '@/lib/format-utils';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboardData();
  
  // Provide default data structure to prevent crashes
  const dashboardData = data || {
    todaySales: 0,
    todayPayments: 0,
    totalReadings: 0,
    pendingClosures: 0,
    trendsData: [],
    fuelPrices: {},
    alerts: [],
    lastReading: null
  };
  
  const logActivity = useActivityLogger();
  useEffect(() => {
    logActivity("dashboard_view", {
      browser: window.navigator.userAgent,
      path: window.location.pathname,
    });
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: fuelPricesList, isLoading: isPricesLoading } = useFuelPricesData();
  const roleAccess = useRoleAccess();
  const { currentStation, isEmployee } = roleAccess;
  const { setStationId } = useFuelPricesGlobal();

  useEffect(() => {
    if (currentStation && currentStation.id) {
      setStationId(currentStation.id);
    }
  }, [currentStation, setStationId]);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const checklist = useSetupChecklist();

  const premiumRequired = false; // Premium features not implemented yet
  const variance = dashboardData.todayPayments - dashboardData.todaySales;

  // Build fuel price object for FuelPriceCard - normalize keys using enum
  const fuelPricesObj: Record<string, number> = {};
  if (dashboardData.fuelPrices) {
    Object.entries(dashboardData.fuelPrices).forEach(([key, value]) => {
      if (value !== undefined) {
        fuelPricesObj[normalizeFuelType(key)] = value;
      }
    });
  } else if (Array.isArray(fuelPricesList)) {
    fuelPricesList.forEach((cur) => {
      // Get fuel type from any available field and normalize using enum helper
      const fuelType = cur.fuel_type ?? cur.fuelType;
      const pricePerLitre = cur.price_per_litre ?? cur.pricePerLitre ?? cur.price;
      if (fuelType && pricePerLitre !== undefined) {
        fuelPricesObj[normalizeFuelType(fuelType)] = pricePerLitre;
      }
    });
  }

  // --- Lock overlay click handler
  const onLockUpgradeClick = () => setShowUpgrade(true);

  // Employees cannot set fuel prices - only manager and above can
  const canSetPrices = user?.role && ['manager', 'owner', 'super_admin'].includes(user.role);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  // Check if user has no stations assigned
  const hasNoStationsAlert = dashboardData.alerts?.some(alert => alert.id === 'no_stations');
  if (hasNoStationsAlert) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Welcome to FuelSync</h1>
            <p className="text-lg text-muted-foreground max-w-md">
              {user?.role === 'manager' 
                ? 'You need to be assigned to a station to access the dashboard. Please contact your administrator.'
                : 'No stations found. Create your first station to start tracking fuel sales.'}
            </p>
            {user?.role === 'owner' && (
              <Button onClick={() => window.location.href = `${getBasePath(user?.role)}/stations`}>
                Create Station
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // New: Render only free cards for key metrics and compact premium card/sections
  function KeyMetricsFreeCards() {
    const todaySales = dashboardData.todaySales ?? 0;
    const todayPayments = dashboardData.todayPayments ?? 0;
    const pendingClosures = dashboardData.pendingClosures ?? 0;
    
    return (
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Sales Today */}
        <Card className="card-mobile border-l-4 border-l-green-500 hover:scale-[1.01] transition-transform">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Sales Today</CardTitle>
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl sm:text-2xl font-bold text-green-600">₹{safeToFixed(todaySales)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From fuel dispensing
            </p>
          </CardContent>
        </Card>
        
        {/* Total Payments */}
        <Card className="card-mobile border-l-4 border-l-blue-500 hover:scale-[1.01] transition-transform">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Payments</CardTitle>
            <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">₹{safeToFixed(todayPayments)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Cash, card, UPI & credit
            </p>
          </CardContent>
        </Card>
        
        {/* Pending Closures */}
        <Card className="card-mobile border-l-4 border-l-amber-500 hover:scale-[1.01] transition-transform sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Pending Closures</CardTitle>
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className={`text-xl sm:text-2xl font-bold ${pendingClosures > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {pendingClosures}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingClosures > 0 ? 'Need attention' : 'All closed'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function KeyMetricPremiumPromo() {
    return (
      <Card className="flex items-center justify-between w-full bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-dashed border-yellow-400 card-mobile">
        <CardContent className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center py-4 px-4 w-full">
          <Lock className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-600 flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="font-semibold text-sm sm:text-base text-yellow-800">Unlock Daily Variance Analytics</div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              Upgrade to Premium to monitor sales vs collection discrepancies each day.
            </div>
          </div>
          <Button 
            variant="default" 
            size="sm"
            className="bg-yellow-500 hover:bg-yellow-600 text-white touch-target w-full sm:w-auto"
            onClick={onLockUpgradeClick}
          >
            Upgrade Now
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Simplified dashboard for employees: only essential, accessible cards
  function EmployeeDashboard() {
    const d: any = dashboardData as any;
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="card-mobile border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Sales Today</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold text-green-600">₹{safeToFixed(d.today?.amount ?? d.todaySales ?? 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">From fuel dispensing</p>
            </CardContent>
          </Card>

          <Card className="card-mobile border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Litres Dispensed</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold text-blue-600">{safeToFixed(d.today?.litres ?? d.todayLitres ?? 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">Total litres today</p>
            </CardContent>
          </Card>

          <Card className="card-mobile border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Readings Today</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold text-amber-600">{d.today?.readings ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Nozzle readings recorded</p>
            </CardContent>
          </Card>
        </div>

        {/* Pumps summary */}
        <div className="space-y-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pumps (Today)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {Array.isArray(d.pumps) && d.pumps.length > 0 ? (
                  d.pumps.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="text-sm font-medium">{p.name} • {p.number}</div>
                      <div className="text-sm text-muted-foreground">{p.today?.litres ?? 0}L • ₹{safeToFixed(p.today?.amount ?? 0)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground">No pump activity</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Quick Actions + Compact Trends */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <QuickActions />
          </div>
          <div className="sm:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Today Sales Trend</CardTitle>
                <CardDescription className="text-xs">Last 7 entries</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendsChart data={d.trendsData ?? dashboardData.trendsData} isLoading={!d.trendsData && !dashboardData.trendsData} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  function TrendsChartPremiumPromo() {
    return (
      <Card className="h-full min-h-[200px] sm:min-h-[240px] flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-dashed border-yellow-400 card-mobile">
        <CardHeader className="items-center text-center px-4">
          <div className="rounded-full bg-yellow-100 p-3 mb-3">
            <Lock className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-600" />
          </div>
          <CardTitle className="text-base sm:text-lg">
            Unlock 7-Day Sales Trends
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-5 flex flex-col items-center px-4">
          <p className="text-muted-foreground text-center text-xs sm:text-sm mb-4 max-w-md">
            Visualize sales patterns and trends for business insight.
            Upgrade to Premium to get charts and analytics.
          </p>
          <Button 
            variant="default" 
            size="sm"
            className="bg-yellow-500 hover:bg-yellow-600 text-white touch-target"
            onClick={onLockUpgradeClick}
          >
            Upgrade to Premium
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container-mobile space-y-mobile animate-fade-in pb-6">
      {/* Setup Checklist - Mobile optimized */}
      <div className="animate-slide-up">
        <SetupChecklist checklist={checklist} />
      </div>
      
      {/* Header Section with Fuel Prices - Compact unified header */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-responsive-sm text-muted-foreground">
              Welcome back, <span className="font-medium text-foreground">{user?.name}</span>
            </p>
          </div>
          {/* Fuel Prices in header on desktop, below on mobile */}
          <div className="sm:ml-auto">
            <FuelPriceCard prices={fuelPricesObj || {}} isLoading={isPricesLoading} canSetPrices={canSetPrices} />
          </div>
        </div>
      </div>

      {/* Alerts - Full width mobile */}
      <AlertBadges alerts={dashboardData.alerts ?? []} />

      {/* Key Metrics - Render simplified view for employees */}
      {isEmployee ? (
        <EmployeeDashboard />
      ) : (
        (premiumRequired ? (
          <div className="space-y-3 sm:space-y-4">
            <KeyMetricsFreeCards />
            <KeyMetricPremiumPromo />
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Sales Today */}
            <Card className="card-mobile border-l-4 border-l-green-500 hover:scale-[1.01] transition-transform">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Sales Today</CardTitle>
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-xl sm:text-2xl font-bold text-green-600">₹{safeToFixed(dashboardData.todaySales ?? 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  From fuel dispensing
                </p>
              </CardContent>
            </Card>

            {/* Total Payments */}
            <Card className="card-mobile border-l-4 border-l-blue-500 hover:scale-[1.01] transition-transform">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Payments</CardTitle>
                <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-xl sm:text-2xl font-bold text-blue-600">₹{safeToFixed(dashboardData.todayPayments ?? 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cash, card, UPI & credit
                </p>
              </CardContent>
            </Card>

            {/* Pending Closures */}
            <Card className="card-mobile border-l-4 border-l-amber-500 hover:scale-[1.01] transition-transform">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Pending Closures</CardTitle>
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className={`text-xl sm:text-2xl font-bold ${(dashboardData.pendingClosures ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {dashboardData.pendingClosures ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(dashboardData.pendingClosures ?? 0) > 0 ? 'Need attention' : 'All closed'}
                </p>
              </CardContent>
            </Card>

            {/* Daily Variance */}
            <Card className="card-mobile border-l-4 border-l-purple-500 hover:scale-[1.01] transition-transform">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Daily Variance</CardTitle>
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className={`text-xl sm:text-2xl font-bold ${Math.abs(variance) < 1 ? 'text-green-600' : variance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {Math.abs(variance) < 1 ? 'Balanced' : `${variance > 0 ? '+' : '-'}₹${safeToFixed(Math.abs(variance))}`}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.abs(variance) < 1 ? 'Sales match collections' : variance > 0 ? 'Collection excess' : 'Collection shortage'}
                </p>
              </CardContent>
            </Card>
          </div>
        ))
      )}

      {/* Charts and Actions - Stack on mobile, side by side on desktop
          Hidden for employees because EmployeeDashboard already shows a compact trends + quick actions */}
      {!isEmployee && (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Trends Chart - Full width on mobile, 2 cols on desktop */}
          <div className="lg:col-span-2 relative animate-slide-up">
            {premiumRequired ? (
              <TrendsChartPremiumPromo />
            ) : (
              <TrendsChart data={dashboardData.trendsData} isLoading={isLoading} />
            )}
          </div>
          
          {/* Sidebar content - Quick Actions only */}
          <div className="space-y-4 sm:space-y-6">
            <QuickActions />
          </div>
        </div>
      )}

      {/* Reading Summary - Full width (hide for employees to avoid duplicate cards) */}
      {!isEmployee && (
        <ReadingSummary totalReadings={dashboardData.totalReadings ?? 0} lastReading={dashboardData.lastReading ?? null} />
      )}
      
      {/* Upgrade Modal */}
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}
