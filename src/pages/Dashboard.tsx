
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { DollarSign, Fuel, TrendingUp, Clock, AlertTriangle, ListChecks, Lock } from "lucide-react";
import { TrendsChart } from "@/components/dashboard/TrendsChart";
import { FuelPriceCard } from "@/components/dashboard/FuelPriceCard";
import { AlertBadges } from "@/components/dashboard/AlertBadges";
import { useDashboardData } from "@/hooks/useDashboardData";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";
import { useState, useEffect } from "react";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useFuelPricesData } from "@/hooks/useFuelPricesData";
import { Button } from "@/components/ui/button";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useNavigate } from "react-router-dom";
import { SetupChecklist } from "@/components/dashboard/SetupChecklist";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ReadingSummary } from "@/components/dashboard/ReadingSummary";
import { useSetupChecklist } from "@/hooks/useSetupChecklist";

export default function Dashboard() {
  const logActivity = useActivityLogger();
  useEffect(() => {
    logActivity("dashboard_view", {
      browser: window.navigator.userAgent,
      path: window.location.pathname,
    });
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { user } = useAuth();
  const { data, isLoading } = useDashboardData();
  const { data: fuelPricesList, isLoading: isPricesLoading } = useFuelPricesData();
  const { currentStation } = useRoleAccess();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const checklist = useSetupChecklist();

  const premiumRequired = false; // Premium features not implemented yet
  const variance = data.todayTender - data.todaySales;

  // Build fuel price object for FuelPriceCard - normalize keys to uppercase
  const fuelPricesObj: Record<string, number> = {};
  if (data.fuelPrices) {
    Object.entries(data.fuelPrices).forEach(([key, value]) => {
      if (value !== undefined) {
        fuelPricesObj[key.toUpperCase()] = value;
      }
    });
  } else if (fuelPricesList) {
    fuelPricesList.forEach((cur: any) => {
      fuelPricesObj[cur.fuel_type?.toUpperCase()] = cur.price_per_litre;
    });
  }

  // --- Lock overlay click handler
  const onLockUpgradeClick = () => setShowUpgrade(true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  // New: Render only free cards for key metrics and compact premium card/sections
  function KeyMetricsFreeCards() {
    return (
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Sales Today */}
        <Card className="card-mobile border-l-4 border-l-green-500 hover:scale-[1.01] transition-transform">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Sales Today</CardTitle>
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl sm:text-2xl font-bold text-green-600">₹{data.todaySales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From fuel dispensing
            </p>
          </CardContent>
        </Card>
        
        {/* Total Tender */}
        <Card className="card-mobile border-l-4 border-l-blue-500 hover:scale-[1.01] transition-transform">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Tender</CardTitle>
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">₹{data.todayTender.toFixed(2)}</div>
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
            <div className={`text-xl sm:text-2xl font-bold ${data.pendingClosures > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.pendingClosures}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.pendingClosures > 0 ? 'Need attention' : 'All closed'}
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
            <h1 className="text-responsive-lg font-bold text-foreground">Dashboard</h1>
            <p className="text-responsive-sm text-muted-foreground">
              Welcome back, <span className="font-medium text-foreground">{user?.name}</span>
            </p>
          </div>
          {/* Fuel Prices in header on desktop, below on mobile */}
          <div className="sm:ml-auto">
            <FuelPriceCard prices={fuelPricesObj || {}} isLoading={isPricesLoading} />
          </div>
        </div>
      </div>

      {/* Alerts - Full width mobile */}
      <AlertBadges alerts={data.alerts} />

      {/* Key Metrics - Responsive grid */}
      {premiumRequired ? (
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
              <div className="text-xl sm:text-2xl font-bold text-green-600">₹{data.todaySales.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                From fuel dispensing
              </p>
            </CardContent>
          </Card>

          {/* Total Tender */}
          <Card className="card-mobile border-l-4 border-l-blue-500 hover:scale-[1.01] transition-transform">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Tender</CardTitle>
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold text-blue-600">₹{data.todayTender.toFixed(2)}</div>
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
              <div className={`text-xl sm:text-2xl font-bold ${data.pendingClosures > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {data.pendingClosures}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.pendingClosures > 0 ? 'Need attention' : 'All closed'}
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
                {Math.abs(variance) < 1 ? 'Balanced' : `${variance > 0 ? '+' : '-'}₹${Math.abs(variance).toFixed(2)}`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.abs(variance) < 1 ? 'Sales match collections' : variance > 0 ? 'Collection excess' : 'Collection shortage'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts and Actions - Stack on mobile, side by side on desktop */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Trends Chart - Full width on mobile, 2 cols on desktop */}
        <div className="lg:col-span-2 relative animate-slide-up">
          {premiumRequired ? (
            <TrendsChartPremiumPromo />
          ) : (
            <TrendsChart data={data.trendsData} isLoading={isLoading} />
          )}
        </div>
        
        {/* Sidebar content - Quick Actions only */}
        <div className="space-y-4 sm:space-y-6">
          <QuickActions />
        </div>
      </div>

      {/* Reading Summary - Full width */}
      <ReadingSummary totalReadings={data.totalReadings} lastReading={data.lastReading} />
      
      {/* Upgrade Modal */}
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}
