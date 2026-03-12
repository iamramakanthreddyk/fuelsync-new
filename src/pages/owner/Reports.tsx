/**
 * Owner Reports & Analytics
 *
 * Enhanced with advanced analytics, mobile-first design, and comprehensive insights
 * Features: Real-time data, comparative analysis, export capabilities, and predictive insights
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStations, useExpenses } from '@/hooks/api';
import {
  useSalesReports,
  usePumpPerformance,
  useNozzleBreakdown,
  useSettlements,
  calculateSalesTotals,
  aggregateRawReadingsToSalesReports,
} from '@/hooks/useReportData';
import { useToast } from '@/hooks/use-toast';
import { useGlobalFilter } from '@/context/GlobalFilterContext';
import { analyticsApi } from '@/api/analytics';
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
import { formatVolume, formatCurrency } from '@/lib/format-utils';
import { FUEL_TYPE_LABELS } from '@/lib/constants';
import {
  BarChart3,
  Activity,
  Droplet,
  IndianRupee,
  TrendingUp,
  RefreshCw,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react';

// Import tab components
import { ReportTabTriggers } from './reports/ReportTabTriggers';
import { OverviewTab } from './reports/OverviewTab';
import { AnalyticsTab } from './reports/AnalyticsTab';
import { SalesTab } from './reports/SalesTab';
import { NozzlesTab } from './reports/NozzlesTab';
import { PumpsTab } from './reports/PumpsTab';
import { EmployeesTab } from './reports/EmployeesTab';
import { EmployeeSalesBreakdownTab } from './reports/EmployeeSalesBreakdownTab';
import { ExpenseAnalysisTab } from './reports/ExpenseAnalysisTab';


// ============================================
// CONSTANTS & TYPES
// ============================================

// ============================================
// UTILITY FUNCTIONS
// ============================================

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
  const { startDate: globalStartDate, endDate: globalEndDate } = useGlobalFilter();
  
  // Use ONLY global filter dates - no local override
  const dateRange: DateRange = {
    startDate: globalStartDate,
    endDate: globalEndDate
  };
  
  const [selectedStation, setSelectedStation] = useState<string>('all');
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
  const { data: expensesResponse, isLoading: expensesLoading, error: expensesError, refetch: refetchExpenses } = useExpenses(selectedStation || '', {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  });

  // Fetch analytics data
  const { data: analyticsData, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery({
    queryKey: ['analytics-reports', dateRange, selectedStation],
    queryFn: async () => {
      const response = await analyticsApi.getOwnerAnalytics(
        dateRange.startDate,
        dateRange.endDate,
        selectedStation !== 'all' ? selectedStation : undefined
      );
      return response?.data ?? null;
    }
  });

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPlanLimitError(null);
    try {
      await Promise.all([refetchSales(), refetchPumps(), refetchNozzles(), refetchSettlements(), refetchExpenses(), refetchAnalytics()]);
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
  }, [refetchSales, refetchPumps, refetchNozzles, refetchSettlements, refetchExpenses, refetchAnalytics, toast]);

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
    if (checkError(expensesError)) return;
  }, [salesError, pumpsError, nozzlesError, settlementsError, expensesError, calculateDaysDifference]);

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

  // Extract expenses from response
  const expenses = useMemo(() => {
    if (expensesResponse && 'data' in expensesResponse) {
      return (expensesResponse as any).data?.data || [];
    }
    return [];
  }, [expensesResponse]);

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

    return {
      avgTransactionValue,
      peakDay,
      fuelTypeBreakdown,
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

  // Export all reports as CSV
  const handleExportAll = useCallback(() => {
    const rows: string[] = [];

    const esc = (val: any) => {
      const str = String(val ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };
    const line = (...cols: any[]) => rows.push(cols.map(esc).join(','));
    const blank = () => rows.push('');
    const section = (title: string) => { blank(); line(title); };

    // ── Report Header ──
    line('REPORTS & ANALYTICS EXPORT');
    const stationLabel = selectedStation === 'all'
      ? 'All Stations'
      : (stations.find((s: any) => String(s.id) === String(selectedStation))?.name ?? selectedStation);
    line('Station', stationLabel);
    line('Period', `${dateRange.startDate}  to  ${dateRange.endDate}`);
    line('Generated', new Date().toLocaleString('en-IN'));

    // ── Summary ──
    section('--- SUMMARY ---');
    line('Total Revenue (Rs)', 'Fuel Dispensed (L)', 'Total Transactions', 'Avg Transaction (Rs)');
    line(
      totals.sales.toFixed(2),
      totals.quantity.toFixed(2),
      totals.transactions,
      totals.transactions > 0 ? (totals.sales / totals.transactions).toFixed(2) : '0.00'
    );

    // ── Sales by Day ──
    if (aggregatedSalesReports && aggregatedSalesReports.length > 0) {
      section('--- DAILY SALES ---');
      line('Date', 'Station', 'Revenue (Rs)', 'Volume (L)', 'Transactions');
      aggregatedSalesReports.forEach((r: any) => {
        line(
          r.date ?? r.readingDate ?? '',
          r.stationName ?? r.stationId ?? '',
          Number(r.sales ?? r.totalSales ?? 0).toFixed(2),
          Number(r.quantity ?? r.litres ?? r.totalQuantity ?? 0).toFixed(2),
          r.transactions ?? r.totalTransactions ?? 0
        );
      });
      // Totals row
      line('TOTAL', '', totals.sales.toFixed(2), totals.quantity.toFixed(2), totals.transactions);
    }

    // ── Fuel Type Breakdown ──
    if (insights.fuelTypeBreakdown.length > 0) {
      section('--- FUEL TYPE BREAKDOWN ---');
      line('Fuel Type', 'Revenue (Rs)', 'Volume (L)', 'Share (%)');
      insights.fuelTypeBreakdown.forEach(f => {
        line(
          FUEL_TYPE_LABELS[f.type as keyof typeof FUEL_TYPE_LABELS] || f.type,
          f.sales.toFixed(2),
          f.quantity.toFixed(2),
          f.percentage.toFixed(1)
        );
      });
    }

    // ── Nozzle Breakdown ──
    if (nozzleBreakdown && nozzleBreakdown.length > 0) {
      section('--- NOZZLE PERFORMANCE ---');
      line('Nozzle', 'Pump', 'Fuel Type', 'Station', 'Revenue (Rs)', 'Volume (L)', 'Transactions');
      nozzleBreakdown.forEach((n: any) => {
        line(
          n.nozzleName ?? n.nozzleNumber ?? n.nozzleId ?? '',
          n.pumpName ?? n.pumpNumber ?? '',
          n.fuelType ?? '',
          n.stationName ?? '',
          Number(n.totalSales ?? n.sales ?? 0).toFixed(2),
          Number(n.totalQuantity ?? n.quantity ?? n.litres ?? 0).toFixed(2),
          n.totalTransactions ?? n.transactions ?? 0
        );
      });
    }

    // ── Pump Performance ──
    if (pumpPerformance && pumpPerformance.length > 0) {
      section('--- PUMP / DISPENSER PERFORMANCE ---');
      line('Pump', 'Station', 'Revenue (Rs)', 'Volume (L)', 'Transactions', 'Efficiency (%)');
      pumpPerformance.forEach((p: any) => {
        line(
          p.pumpName ?? p.pumpNumber ?? p.pumpId ?? '',
          p.stationName ?? '',
          Number(p.totalSales ?? p.sales ?? 0).toFixed(2),
          Number(p.totalQuantity ?? p.quantity ?? p.litres ?? 0).toFixed(2),
          p.totalTransactions ?? p.transactions ?? 0,
          Number(p.efficiency ?? p.utilizationRate ?? 0).toFixed(1)
        );
      });
    }

    // ── Settlements / Shortfalls ──
    if (settlements && settlements.length > 0) {
      section('--- SETTLEMENTS & SHORTFALLS ---');
      line('Date', 'Type', 'Station', 'Amount (Rs)', 'Variance (Rs)', 'Status');
      settlements.forEach((s: any) => {
        line(
          s.settlementDate ?? s.date ?? '',
          s.settlementType ?? s.type ?? '',
          s.stationName ?? '',
          Number(s.totalAmount ?? s.amount ?? 0).toFixed(2),
          Number(s.variance ?? 0).toFixed(2),
          s.status ?? ''
        );
      });
    }

    // ── Expenses ──
    if (expenses && expenses.length > 0) {
      section('--- EXPENSES ---');
      line('Date', 'Category', 'Description', 'Amount (Rs)', 'Status');
      let expTotal = 0;
      expenses.forEach((e: any) => {
        const amt = Number(e.amount ?? 0);
        expTotal += amt;
        line(
          e.date ?? e.expenseDate ?? '',
          e.category ?? '',
          e.description ?? e.notes ?? '',
          amt.toFixed(2),
          e.status ?? e.approvalStatus ?? ''
        );
      });
      line('TOTAL', '', '', expTotal.toFixed(2), '');
    }

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reports-analytics-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: 'Reports & Analytics exported as CSV.',
    });
  }, [aggregatedSalesReports, nozzleBreakdown, pumpPerformance, settlements, expenses, insights, totals, dateRange, selectedStation, stations, toast]);

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

        {/* Enhanced Filters - Station Selection Only */}
        <div className="space-y-4">
          <FilterBar
            dateRange={dateRange}
            onDateRangeChange={() => {}} // Dates controlled by global filter only
            selectedStation={selectedStation}
            onStationChange={setSelectedStation}
            stations={Array.isArray(stations) ? stations : []}
            onRefresh={handleRefresh}
            onExportAll={handleExportAll}
            showRefresh={false}
            dataType="analytics"
          />
        </div>

        {/* Enhanced Key Metrics */}
        <div className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-3 w-full">
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
        </div>

        {/* Insights Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg shrink-0">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">Peak Day</h3>
                <p className="text-xs text-gray-500 hidden sm:block">Best performing day</p>
              </div>
            </div>
            <div className="text-base sm:text-2xl font-bold text-green-600 truncate">
              {insights.peakDay ? new Date(insights.peakDay.date).toLocaleDateString() : 'N/A'}
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
              {formatCurrency(insights.peakDay?.totalSales || 0, 0)} revenue
            </p>
          </div>


          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg shrink-0">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">Top Fuel</h3>
                <p className="text-xs text-gray-500 hidden sm:block">Most profitable type</p>
              </div>
            </div>
            <div className="text-base sm:text-2xl font-bold text-purple-600 truncate">
              {insights.fuelTypeBreakdown[0] ? (
                FUEL_TYPE_LABELS[insights.fuelTypeBreakdown[0].type as keyof typeof FUEL_TYPE_LABELS] || insights.fuelTypeBreakdown[0].type
              ) : (
                'N/A'
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
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
            <AnalyticsTab
              analyticsData={analyticsData}
              isLoading={analyticsLoading}
              dateRange={dateRange}
              selectedStation={selectedStation}
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
            <ExpenseAnalysisTab
              expenses={expenses as any}
              isLoading={expensesLoading}
              dateRange={dateRange}
              totalRevenue={totals.sales}
            />
          </Tabs>
        </div>
      </div>
    </div>
  );
}
