
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-2">
        {/* Total Sales Today */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">₹{data.todaySales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              From fuel dispensing
            </p>
          </CardContent>
        </Card>
        {/* Total Tender */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tender</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">₹{data.todayTender.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Cash, card, UPI & credit
            </p>
          </CardContent>
        </Card>
        {/* Pending Closures */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Closures</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.pendingClosures > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.pendingClosures}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.pendingClosures > 0 ? 'Need attention' : 'All closed'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function KeyMetricPremiumPromo() {
    return (
      <div className="w-full flex">
        <Card className="flex items-center justify-between w-full bg-muted border-dashed border-2 border-yellow-400">
          <CardContent className="flex gap-2 items-center py-4 w-full">
            <Lock className="h-6 w-6 text-yellow-500 mr-3" />
            <div className="flex-1">
              <div className="font-semibold text-yellow-700">Unlock Daily Variance Analytics</div>
              <div className="text-xs text-muted-foreground">Upgrade to Premium to monitor sales vs collection discrepancies each day.</div>
            </div>
            <Button variant="default" className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 ml-4"
              onClick={onLockUpgradeClick}
            >
              Upgrade
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  function TrendsChartPremiumPromo() {
    return (
      <Card className="h-full min-h-[136px] flex flex-col items-center justify-center bg-muted border-dashed border-2 border-yellow-400">
        <CardHeader className="items-center">
          <Lock className="h-7 w-7 text-yellow-500 mb-2" />
          <CardTitle>
            Unlock 7-Day Sales Trends
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 flex flex-col items-center">
          <div className="text-muted-foreground pb-2 text-center text-sm">
            Visualize sales patterns and trends for business insight.<br />
            Upgrade to Premium to get charts and analytics.
          </div>
          <Button 
            variant="default" 
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4"
            onClick={onLockUpgradeClick}
          >
            Upgrade
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <SetupChecklist checklist={checklist} />
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name}! Here's what's happening today.
        </p>
      </div>
      <AlertBadges alerts={data.alerts} />

      {/* ---- Compact metrics and premium promo ---- */}
      {premiumRequired ? (
        <>
          <KeyMetricsFreeCards />
          <KeyMetricPremiumPromo />
        </>
      ) : (
        // show all metrics if premium unlocked
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales Today</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">₹{data.todaySales.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                From fuel dispensing
              </p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tender</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">₹{data.todayTender.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Cash, card, UPI & credit
              </p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Closures</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${data.pendingClosures > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {data.pendingClosures}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.pendingClosures > 0 ? 'Need attention' : 'All closed'}
              </p>
            </CardContent>
          </Card>
          {/* Daily Variance if premium */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Variance</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${Math.abs(variance) < 1 ? 'text-green-600' : variance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {Math.abs(variance) < 1 ? 'Balanced' : `${variance > 0 ? '+' : '-'}₹${Math.abs(variance).toFixed(2)}`}
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.abs(variance) < 1 ? 'Sales match collections' : variance > 0 ? 'Collection excess' : 'Collection shortage'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Trends Chart (Premium ONLY) */}
        <div className="lg:col-span-2 relative">
          {premiumRequired ? (
            <TrendsChartPremiumPromo />
          ) : (
            <TrendsChart data={data.trendsData} isLoading={isLoading} />
          )}
        </div>
        {/* Fuel Prices and Quick Actions */}
        <div className="space-y-6">
          <FuelPriceCard prices={fuelPricesObj || {}} isLoading={isPricesLoading} />
          <QuickActions />
        </div>
      </div>
      <ReadingSummary totalReadings={data.totalReadings} lastReading={data.lastReading} />
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}
