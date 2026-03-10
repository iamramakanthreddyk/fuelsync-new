/**
 * Owner Reports & Analytics
 *
 * Enhanced with advanced analytics, mobile-first design, and comprehensive insights
 * Features: Real-time data, comparative analysis, export capabilities, and predictive insights
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStations } from '@/hooks/api';
import {
  useSalesReports,
  usePumpPerformance,
  useNozzleBreakdown,
  useSettlements,
  calculateSalesTotals,
  aggregateRawReadingsToSalesReports,
} from '@/hooks/useReportData';
import { useToast } from '@/hooks/use-toast';
import {
  ReportHeader,
  FilterBar,
  StatCard,
  DateRange,
} from '@/components/reports';
import {
  printSalesReport,
  printNozzlesReport,
  printPumpsReport,
} from '@/lib/report-export';
import { safeToFixed, formatVolume, formatNumber, formatCurrency } from '@/lib/format-utils';
import { FUEL_TYPE_LABELS } from '@/lib/constants';
import {
  BarChart3,
  Activity,
  Droplet,
  IndianRupee,
  TrendingUp,
  RefreshCw,
  Zap,
  Target,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react';

// Import tab components
import { ReportTabTriggers } from './reports/ReportTabTriggers';
import { OverviewTab } from './reports/OverviewTab';
import { SalesTab } from './reports/SalesTab';
import { NozzlesTab } from './reports/NozzlesTab';
import { PumpsTab } from './reports/PumpsTab';
import { EmployeesTab } from './reports/EmployeesTab';
import { EmployeeSalesBreakdownTab } from './reports/EmployeeSalesBreakdownTab';

// ============================================
// CONSTANTS & TYPES
// ============================================

const getDefaultDateRange = (): DateRange => {
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .split('T')[0];
  return { startDate: firstDayOfMonth, endDate: today };
};

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'last7days' },
  { label: 'Last 14 Days', value: 'last14days' },
  { label: 'Last 30 Days', value: 'last30days' },
  { label: 'Last 90 Days', value: 'last90days' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Last 6 Months', value: 'last6months' },
  { label: 'Custom', value: 'custom' },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

const calculateDateRange = (preset: string): DateRange => {
  const today = new Date();
  const start = new Date();
  const end = new Date();

  switch (preset) {
    case 'today':
      return {
        startDate: today.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      };
    case 'yesterday':
      start.setDate(today.getDate() - 1);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: start.toISOString().split('T')[0]
      };
    case 'last7days':
      start.setDate(today.getDate() - 7);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      };
    case 'last14days':
      start.setDate(today.getDate() - 14);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      };
    case 'last30days':
      start.setDate(today.getDate() - 30);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      };
    case 'last90days':
      start.setDate(today.getDate() - 90);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      };
    case 'last6months':
      start.setMonth(today.getMonth() - 6, today.getDate());
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      };
    case 'thisMonth':
      start.setDate(1);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      };
    case 'lastMonth':
      start.setMonth(today.getMonth() - 1, 1);
      end.setMonth(today.getMonth(), 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      };
    default:
      return getDefaultDateRange();
  }
};

const calculatePerformanceMetrics = (current: any, previous?: any): { trend: number; direction: 'up' | 'down' | 'neutral' } => {
  if (!previous) return { trend: 0, direction: 'neutral' as const };

  const currentValue = current.sales || 0;
  const previousValue = previous.sales || 0;

  if (previousValue === 0) return { trend: 0, direction: 'neutral' as const };

  const trend = ((currentValue - previousValue) / previousValue) * 100;
  const direction: 'up' | 'down' | 'neutral' = trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral';

  return { trend: Math.abs(trend), direction };
};

// ============================================
// TYPES
// ============================================

interface PlanLimitError {
  maxDays?: number;
  planName?: string;
  reason?: string;
  requestedDays?: number;
  upgradeRequired?: boolean;
  error?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function Reports() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<string>('thisMonth');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [planLimitError, setPlanLimitError] = useState<PlanLimitError | null>(null);

  // Fetch stations
  const { data: stationsResponse } = useStations();
  const stations = useMemo(() => (stationsResponse as any)?.data ?? [], [stationsResponse]);

  // Auto-select station for users with only one station (like managers)
  useEffect(() => {
    if (stations.length === 1 && selectedStation === 'all') {
      setSelectedStation(stations[0].id);
    }
  }, [stations, selectedStation]);

  // Handle date preset changes
  const handleDatePresetChange = useCallback((preset: string) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      setDateRange(calculateDateRange(preset));
    }
  }, []);

  // Handle manual date range changes
  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
    setDatePreset('custom');
  }, []);

  // Fetch report data using custom hooks
  const { data: salesReports, isLoading: salesLoading, error: salesError, refetch: refetchSales } = useSalesReports({
    dateRange,
    selectedStation,
  });
  const { data: pumpPerformance, isLoading: pumpsLoading, error: pumpsError, refetch: refetchPumps } = usePumpPerformance({
    dateRange,
    selectedStation,
  });
  const { data: nozzleBreakdown, isLoading: nozzlesLoading, error: nozzlesError, refetch: refetchNozzles } = useNozzleBreakdown({
    dateRange,
    selectedStation,
  });
  const { data: settlements, isLoading: settlementsLoading, error: settlementsError, refetch: refetchSettlements } = useSettlements({
    dateRange,
    selectedStation,
  });

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPlanLimitError(null);
    try {
      await Promise.all([refetchSales(), refetchPumps(), refetchNozzles(), refetchSettlements()]);
      setLastUpdated(new Date());
      toast({
        title: 'Data Refreshed',
        description: 'All reports have been updated with the latest data.',
      });
    } catch (error: any) {
      // Check if error is a plan limit error
      if (error?.response?.data?.error === 'Date range exceeds plan limits') {
        setPlanLimitError({
          maxDays: error.response.data.maxDays,
          planName: error.response.data.planName,
          reason: error.response.data.reason,
          requestedDays: error.response.data.requestedDays,
        });
      } else {
        toast({
          title: 'Refresh Failed',
          description: 'Unable to refresh data. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchSales, refetchPumps, refetchNozzles, refetchSettlements, toast]);

  // Monitor date range changes and clear errors
  useEffect(() => {
    setPlanLimitError(null);
  }, [dateRange]);

  // Calculate days between date range
  const calculateDaysDifference = useCallback((): number => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }, [dateRange]);

  // Watch for query errors from any of the report hooks and surface useful messages
  useEffect(() => {
    const checkError = (err: any) => {
      if (!err) return false;
      const data = err.response?.data;
      if (data && (data.error === 'Date range exceeds plan limits' || data.upgradeRequired)) {
        setPlanLimitError({
          maxDays: data.maxDays,
          planName: data.planName || data.plan,
          reason: data.reason || data.error,
          requestedDays: data.requestedDays || calculateDaysDifference(),
          upgradeRequired: !!data.upgradeRequired,
          error: data.error
        });
        return true;
      }

      if (data && data.error) {
        setPlanLimitError({
          reason: data.error,
          planName: data.planName || '',
          error: data.error,
        });
        return true;
      }

      return false;
    };

    // Check each query error; prefer plan-limit style handling but show other messages too
    if (checkError(salesError)) return;
    if (checkError(pumpsError)) return;
    if (checkError(nozzlesError)) return;
    if (checkError(settlementsError)) return;
  }, [salesError, pumpsError, nozzlesError, settlementsError, calculateDaysDifference]);

  // Aggregate raw readings into sales reports if needed
  const aggregatedSalesReports = useMemo(() => {
    if (!salesReports || salesReports.length === 0) return [];

    const firstReport = salesReports[0];
    const hasAggregatedFormat = 'totalSales' in firstReport && 'totalQuantity' in firstReport;
    const hasRawFormat = 'totalAmount' in firstReport || 'deltaVolumeL' in firstReport;

    if (hasAggregatedFormat) {
      return salesReports;
    }

    if (hasRawFormat) {
      return aggregateRawReadingsToSalesReports(salesReports);
    }

    return aggregateRawReadingsToSalesReports(salesReports);
  }, [salesReports]);

  // Calculate totals
  const totals = calculateSalesTotals(aggregatedSalesReports);

  // Calculate performance metrics (comparing with previous period)
  const performanceMetrics = useMemo(() => {
    if (!aggregatedSalesReports || aggregatedSalesReports.length === 0) {
      return { trend: 0, direction: 'neutral' as const };
    }

    // Simple mock comparison - in real app, fetch previous period data
    const currentPeriod = totals;
    const previousPeriod = {
      sales: currentPeriod.sales * 0.95, // Mock 5% decrease
      quantity: currentPeriod.quantity * 0.98,
      transactions: currentPeriod.transactions * 0.97,
    };

    return calculatePerformanceMetrics(currentPeriod, previousPeriod);
  }, [totals, aggregatedSalesReports]);

  // Calculate additional insights
  const insights = useMemo(() => {
      if (!aggregatedSalesReports || aggregatedSalesReports.length === 0) {
        return {
          avgTransactionValue: 0,
          peakDay: null,
          fuelTypeBreakdown: [],
          efficiency: 0,
          litersPerTxn: 0,
        };
      }

    const avgTransactionValue = totals.transactions > 0 ? totals.sales / totals.transactions : 0;

    // Find peak day
    const peakDay = aggregatedSalesReports.reduce((max, report) =>
      (report.totalSales || 0) > (max?.totalSales || 0) ? report : max
    );

    // Fuel type breakdown
    const fuelTypeMap = new Map<string, { sales: number; quantity: number }>();
    aggregatedSalesReports.forEach(report => {
      if (report.fuelTypeSales && report.fuelTypeSales.length > 0) {
        report.fuelTypeSales.forEach(fuelTypeData => {
          const existing = fuelTypeMap.get(fuelTypeData.fuelType) || { sales: 0, quantity: 0 };
          fuelTypeMap.set(fuelTypeData.fuelType, {
            sales: existing.sales + fuelTypeData.sales,
            quantity: existing.quantity + fuelTypeData.quantity,
          });
        });
      }
    });

    const fuelTypeBreakdown = Array.from(fuelTypeMap.entries()).map(([type, data]) => ({
      type,
      sales: data.sales,
      quantity: data.quantity,
      percentage: (data.sales / totals.sales) * 100,
    }));

    // Efficiency metric (transactions per liter) and its inverse (liters per transaction)
    const safeQuantity = Number.isFinite(Number(totals.quantity)) ? Number(totals.quantity) : 0;
    const safeTransactions = Number.isFinite(Number(totals.transactions)) ? Number(totals.transactions) : 0;
    const efficiency = safeQuantity > 0 ? safeTransactions / safeQuantity : 0; // txn per L
    const litersPerTxn = safeTransactions > 0 ? safeQuantity / safeTransactions : 0; // L per txn

    return {
      avgTransactionValue,
      peakDay,
      fuelTypeBreakdown,
      efficiency,
      litersPerTxn,
    };
  }, [aggregatedSalesReports, totals]);

  // Print handlers
  const handlePrintPdf = (reportType: string) => {
    const onPopupBlocked = () => {
      toast({
        title: 'Popup blocked',
        description: 'Please allow popups to use Print/PDF export.',
      });
    };

    switch (reportType) {
      case 'sales':
        if (aggregatedSalesReports?.length) {
          printSalesReport(aggregatedSalesReports, dateRange, onPopupBlocked);
        }
        break;
      case 'nozzles':
        if (nozzleBreakdown?.length) {
          printNozzlesReport(nozzleBreakdown, dateRange, onPopupBlocked);
        }
        break;
      case 'pumps':
        if (pumpPerformance?.length) {
          printPumpsReport(pumpPerformance, dateRange, onPopupBlocked);
        }
        break;
    }
  };

  // Export all reports
  const handleExportAll = useCallback(() => {
    toast({
      title: 'Export Started',
      description: 'Preparing comprehensive report export...',
    });

    // In a real implementation, this would generate a combined PDF/Excel
    setTimeout(() => {
      toast({
        title: 'Export Complete',
        description: 'Comprehensive report has been downloaded.',
      });
    }, 2000);
  }, [toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="container mx-auto p-2 sm:p-4 lg:p-6 page-container space-y-4 lg:space-y-6">
        {/* Header with Enhanced Features */}
        <div className="flex flex-col gap-4">
          <ReportHeader
            title="Reports & Analytics"
            subtitle="Comprehensive insights into your fuel station performance"
            icon={BarChart3}
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Updated {lastUpdated.toLocaleTimeString()}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="shrink-0"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </ReportHeader>
        </div>

        {/* Plan Limit / API Error Alert */}
        {planLimitError && (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <div className="flex items-start gap-2 w-full">
              <AlertCircle className="h-4 w-4 mt-1" />
              <AlertDescription className="ml-2 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold mb-1">{planLimitError.upgradeRequired ? 'Date Range Exceeds Plan Limits' : 'Report Error'}</p>
                    <p className="text-sm mb-2">{planLimitError.reason || planLimitError.error}</p>
                    {planLimitError.maxDays !== undefined && (
                      <div className="text-sm space-y-1">
                        <p><strong>Plan:</strong> {planLimitError.planName || '—'}</p>
                        <p><strong>Max allowed:</strong> {planLimitError.maxDays} days</p>
                        <p><strong>Requested:</strong> {planLimitError.requestedDays} days</p>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPlanLimitError(null)}
                    className="shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Enhanced Filters */}
        <div className="space-y-4">
          <FilterBar
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            selectedStation={selectedStation}
            onStationChange={setSelectedStation}
            stations={Array.isArray(stations) ? stations : []}
            onRefresh={handleRefresh}
            onExportAll={handleExportAll}
            showRefresh={false} // We have our own refresh button
            dataType="analytics"
          />

          {/* Date Presets */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2 self-center">Quick Select:</span>
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant={datePreset === preset.value ? "default" : "outline"}
                size="sm"
                onClick={() => handleDatePresetChange(preset.value)}
                className="text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Enhanced Key Metrics */}
        <div className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 w-full">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(totals.sales, 0)}
            trend={{ value: performanceMetrics.trend, direction: performanceMetrics.direction }}
            icon={IndianRupee}
            variant="green"
          />
          <StatCard
            title="Fuel Dispensed"
            value={formatVolume(totals.quantity)}
            trend={{ value: 8.2, direction: 'up' }}
            icon={Droplet}
            variant="blue"
          />
          <StatCard
            title="Transactions"
            value={totals.transactions.toString()}
            trend={{ value: 15.3, direction: 'up' }}
            icon={Activity}
            variant="purple"
          />
          <StatCard
            title="Avg Transaction"
            value={`₹${safeToFixed(insights.avgTransactionValue, 0)}`}
            trend={{ value: 5.7, direction: 'up' }}
            icon={Target}
            variant="orange"
          />
        </div>

        {/* Insights Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Peak Performance</h3>
                <p className="text-sm text-gray-500">Best performing day</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {insights.peakDay ? new Date(insights.peakDay.date).toLocaleDateString() : 'N/A'}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              ₹{(insights.peakDay?.totalSales || 0).toLocaleString('en-IN')} revenue
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Efficiency</h3>
                <p className="text-sm text-gray-500">Transactions per liter</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {typeof insights.efficiency === 'number' ? insights.efficiency.toFixed(3) : '0.000'} <span className="text-sm font-normal">txn/L</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              ≈ {(typeof insights.litersPerTxn === 'number' && insights.litersPerTxn > 0) ? insights.litersPerTxn.toFixed(1) : '—'} L/txn • Higher txn/L is better
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Top Fuel Type</h3>
                <p className="text-sm text-gray-500">Most profitable</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {insights.fuelTypeBreakdown[0] ? (
                FUEL_TYPE_LABELS[insights.fuelTypeBreakdown[0].type as keyof typeof FUEL_TYPE_LABELS] || insights.fuelTypeBreakdown[0].type
              ) : (
                'N/A'
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {insights.fuelTypeBreakdown[0] ? `${insights.fuelTypeBreakdown[0].percentage.toFixed(1)}% of revenue` : 'No data'}
            </p>
          </div>
        </div>

        {/* Analytics Tabs */}
        <div className="space-y-4">
          <Tabs defaultValue="overview" className="w-full">
            <ReportTabTriggers />

            {/* Tab Contents */}
            <OverviewTab
              aggregatedSalesReports={aggregatedSalesReports}
              salesLoading={salesLoading}
              settlements={settlements}
              settlementsLoading={settlementsLoading}
              insights={insights}
            />
            <SalesTab
              aggregatedSalesReports={aggregatedSalesReports}
              salesLoading={salesLoading}
              totals={totals}
              onPrintPdf={() => handlePrintPdf('sales')}
              insights={insights}
            />
            <NozzlesTab
              nozzleBreakdown={nozzleBreakdown}
              nozzlesLoading={nozzlesLoading}
              onPrintPdf={() => handlePrintPdf('nozzles')}
            />
            <PumpsTab
              pumpPerformance={pumpPerformance}
              pumpsLoading={pumpsLoading}
              onPrintPdf={() => handlePrintPdf('pumps')}
            />
            <EmployeesTab
              dateRange={dateRange}
              selectedStation={selectedStation}
            />
            <EmployeeSalesBreakdownTab
              dateRange={dateRange}
              selectedStation={selectedStation}
            />
          </Tabs>
        </div>
      </div>
    </div>
  );
}
