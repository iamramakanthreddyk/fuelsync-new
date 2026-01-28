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
import { DashboardHeader, MetricCard, DashboardGrid, COMMON_METRICS } from "@/components/dashboard/shared";

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
        const normalizedKey = normalizeFuelType(key);
        if (normalizedKey) {
          fuelPricesObj[normalizedKey] = value;
        }
      }
    });
  } else if (Array.isArray(fuelPricesList)) {
    fuelPricesList.forEach((cur) => {
      // Get fuel type from any available field and normalize using enum helper
      const fuelType = cur.fuelType;
      const pricePerLitre = cur.price;
      if (fuelType && pricePerLitre !== undefined) {
        const normalizedKey = normalizeFuelType(fuelType);
        if (normalizedKey) {
          fuelPricesObj[normalizedKey] = pricePerLitre;
        }
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

    const metrics = [
      {
        ...COMMON_METRICS.sales,
        value: `₹${safeToFixed(todaySales)}`,
        description: "From fuel dispensing"
      },
      {
        ...COMMON_METRICS.payments,
        value: `₹${safeToFixed(todayPayments)}`,
        description: "Cash, card, UPI & credit"
      },
      {
        ...COMMON_METRICS.closures,
        value: pendingClosures.toString(),
        description: pendingClosures > 0 ? "Need attention" : "All closed",
        variant: pendingClosures > 0 ? ("warning" as const) : ("success" as const)
      }
    ];

    return <DashboardGrid metrics={metrics} />;
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
    const metrics = [
      {
        ...COMMON_METRICS.sales,
        value: `₹${safeToFixed(d.today?.amount ?? d.todaySales ?? 0)}`,
        description: "From fuel dispensing"
      },
      {
        ...COMMON_METRICS.fuel,
        value: safeToFixed(d.today?.litres ?? d.todayLitres ?? 0),
        description: "Total litres today"
      },
      {
        title: "Today's Readings",
        icon: <Clock className="h-4 w-4 sm:h-5 sm:w-5" />,
        color: 'blue' as const,
        value: (d.today?.readings ?? 0).toString(),
        description: "Nozzle readings recorded"
      }
    ];

    return (
      <div className="space-y-3">
        <DashboardGrid metrics={metrics} />

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
    <div className="container-mobile page-container space-y-mobile animate-fade-in pb-6">
      {/* Setup Checklist - Mobile optimized */}
      <div className="animate-slide-up">
        <SetupChecklist checklist={checklist} />
      </div>
      
      {/* Header Section with Fuel Prices - Compact unified header */}
      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-responsive-sm text-muted-foreground">
              Welcome back, <span className="font-medium text-foreground">{user?.name}</span>
            </p>
          </div>
          {/* Fuel Prices - Mobile optimized positioning */}
          <div className="w-full sm:w-auto sm:ml-auto sm:flex-shrink-0">
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
          <DashboardGrid
            metrics={[
              {
                ...COMMON_METRICS.sales,
                value: `₹${safeToFixed(dashboardData.todaySales ?? 0)}`,
                description: "From fuel dispensing"
              },
              {
                ...COMMON_METRICS.payments,
                value: `₹${safeToFixed(dashboardData.todayPayments ?? 0)}`,
                description: "Cash, card, UPI & credit"
              },
              {
                ...COMMON_METRICS.closures,
                value: (dashboardData.pendingClosures ?? 0).toString(),
                description: (dashboardData.pendingClosures ?? 0) > 0 ? "Need attention" : "All closed",
                variant: (dashboardData.pendingClosures ?? 0) > 0 ? ("warning" as const) : ("success" as const)
              },
              {
                ...COMMON_METRICS.variance,
                value: Math.abs(variance) < 1 ? 'Balanced' : `${variance > 0 ? '+' : '-'}₹${safeToFixed(Math.abs(variance))}`,
                description: Math.abs(variance) < 1 ? 'Sales match collections' : variance > 0 ? 'Collection excess' : 'Collection shortage',
                variant: Math.abs(variance) < 1 ? ("success" as const) : variance > 0 ? ("info" as const) : ("danger" as const)
              }
            ]}
          />
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


      
      {/* Upgrade Modal */}
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}
