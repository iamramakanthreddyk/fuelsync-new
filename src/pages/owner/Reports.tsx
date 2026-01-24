/**
 * Owner Reports & Analytics
 * Modern dashboard-style view for sales, shift, and operational reports
 * 
 * Refactored to use reusable components from @/components/reports
 */

import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useFuelPricesGlobal } from '../../context/FuelPricesContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStations } from '@/hooks/api';
import {
  useSalesReports,
  usePumpPerformance,
  useNozzleBreakdown,
  calculateSalesTotals,
  aggregateRawReadingsToSalesReports,
  SalesReport,
} from '@/hooks/useReportData';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  ReportHeader,
  FilterBar,
  ReportSection,
  StatCard,
  SalesReportCard,
  NozzleCard,
  PumpCard,
  DateRange,
} from '@/components/reports';
import {
  printSalesReport,
  printNozzlesReport,
  printPumpsReport,
} from '@/lib/report-export';
import { CHART_COLORS } from '@/lib/constants';
import { safeToFixed } from '@/lib/format-utils';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  BarChart3,
  Activity,
  Droplet,
  LineChart as LineChartIcon,
  IndianRupee,
  Users,
  AlertCircle,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react';

// ============================================
// CONSTANTS
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

// ============================================
// FUEL DISTRIBUTION COMPONENT - REMOVED
// ============================================

// FuelDistribution component removed as requested - data was unusable/dummy

// ============================================
// REVENUE TREND CHART COMPONENT
// ============================================

interface RevenueTrendChartProps {
  salesReports?: SalesReport[];
  isLoading?: boolean;
  className?: string;
}

const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({
  salesReports = [],
  isLoading = false,
  className
}) => {
  // Process sales reports to create chart data
  const chartData = useMemo(() => {
    if (!salesReports || salesReports.length === 0) {
      return [];
    }

    // Group by date and sum total sales
    const dateMap = new Map<string, number>();

    salesReports.forEach(report => {
      const existing = dateMap.get(report.date) || 0;
      dateMap.set(report.date, existing + report.totalSales);
    });

    // Convert to array and sort by date
    return Array.from(dateMap.entries())
      .map(([date, revenue]) => ({
        date: new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        revenue: Math.round(revenue),
        fullDate: date // Keep full date for sorting
      }))
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
  }, [salesReports]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm md:text-lg">
            <LineChartIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            Revenue Trend
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Daily revenue over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 md:h-64 flex items-center justify-center">
            <div className="text-muted-foreground">Loading revenue data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm md:text-lg">
            <LineChartIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            Revenue Trend
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Daily revenue over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 md:h-64 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-dashed border-blue-200">
            <div className="text-center p-4">
              <LineChartIcon className="w-10 h-10 md:w-12 md:h-12 mx-auto text-blue-400 mb-3" />
              <p className="text-blue-600 font-medium text-sm md:text-base">
                No Revenue Data
              </p>
              <p className="text-xs md:text-sm text-blue-500">
                No sales data available for the selected period
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm md:text-lg">
          <LineChartIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
          Revenue Trend
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">Daily revenue over the selected period</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-32 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                className="text-xs"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                className="text-xs"
                tickFormatter={(value) => `₹${safeToFixed(value / 1000, 0)}K`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                        <p className="font-medium text-gray-900">{label}</p>
                        <p className="text-blue-600">
                          Revenue: ₹{safeToFixed(payload[0].value as number, 2)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// EMPLOYEE SHORTFALL REPORT COMPONENT
// ============================================

interface EmployeeShortfallData {
  employeeName: string;
  totalShortfall: number;
  daysWithShortfall: number;
  averagePerDay: number;
  settlementsCount: number;
}

interface EmployeeShortfallReportProps {
  dateRange: DateRange;
  selectedStation: string;
}

const EmployeeShortfallReport: React.FC<EmployeeShortfallReportProps> = ({
  dateRange,
  selectedStation,
}) => {
  const [endpointAvailable, setEndpointAvailable] = React.useState(true);

  // Debug: Log props
  React.useEffect(() => {
    console.log('[EmployeeShortfallReport] Props received:', { dateRange, selectedStation });
  }, [dateRange, selectedStation]);

  // Fetch shortfall data from backend
  const { data: shortfallData, isLoading: shortfallLoading } = useQuery({
    queryKey: ['employee-shortfalls', selectedStation, dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      // Defensive checks
      const hasValidDates = dateRange?.startDate && dateRange?.endDate;
      const hasValidStation = selectedStation && selectedStation !== '';
      
      console.log('[EmployeeShortfallReport] Query running with:', { 
        selectedStation, 
        startDate: dateRange?.startDate, 
        endDate: dateRange?.endDate,
        hasValidDates,
        hasValidStation
      });
      
      if (!hasValidStation || !hasValidDates) {
        console.warn('[EmployeeShortfallReport] Missing required params:', { selectedStation, dateRange });
        return [];
      }
      
      try {
        console.log('[EmployeeShortfallReport] Making API call:', { 
          selectedStation, 
          startDate: dateRange.startDate, 
          endDate: dateRange.endDate 
        });
        
        const response = await apiClient.get(
          `/stations/${selectedStation}/employee-shortfalls`,
          {
            params: {
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
            },
          }
        );
        
        console.log('[EmployeeShortfallReport] API response:', response);
        
        setEndpointAvailable(true);
        
        // Handle response format - apiClient returns response.data
        if (response?.data?.data && Array.isArray(response.data.data)) {
          return response.data.data;
        }
        if (response?.data && Array.isArray(response.data)) {
          return response.data;
        }
        return [];
      } catch (error: any) {
        // Check if it's a 404 (endpoint not implemented yet)
        if (error?.response?.status === 404) {
          setEndpointAvailable(false);
          console.warn('[EmployeeShortfallReport] Endpoint not yet available on backend');
        } else {
          console.error('[EmployeeShortfallReport] Failed to fetch employee shortfalls:', error);
        }
        return [];
      }
    },
    enabled: !!(selectedStation && dateRange?.startDate && dateRange?.endDate),
  });

  const employeeShortfalls: EmployeeShortfallData[] = shortfallData ?? [];

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (employeeShortfalls.length === 0) {
      return {
        totalShortfall: 0,
        employeesAffected: 0,
        averageShortfallPerEmployee: 0,
        highestShortfallEmployee: null as EmployeeShortfallData | null,
      };
    }

    const totalShortfall = employeeShortfalls.reduce((sum, e) => sum + e.totalShortfall, 0);
    const employeesAffected = employeeShortfalls.length;
    const averageShortfallPerEmployee = totalShortfall / employeesAffected;
    const highestShortfallEmployee = employeeShortfalls.reduce((max, e) => 
      e.totalShortfall > max.totalShortfall ? e : max
    );

    return {
      totalShortfall,
      employeesAffected,
      averageShortfallPerEmployee,
      highestShortfallEmployee,
    };
  }, [employeeShortfalls]);

  return (
    <>
      {!endpointAvailable && !shortfallLoading && (
        <Card className="border-amber-200 bg-amber-50 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">Backend Setup Required</h3>
                <p className="text-sm text-amber-800 mb-3">
                  The Employee Shortfall report is ready on the frontend, but requires a backend endpoint to display data.
                </p>
                <div className="text-xs text-amber-700 bg-white p-3 rounded font-mono space-y-1 max-w-md">
                  <div><strong>Endpoint needed:</strong></div>
                  <div className="text-amber-600">GET /api/v1/stations/:stationId/employee-shortfalls</div>
                  <div><strong>Parameters:</strong> startDate, endDate</div>
                  <div className="mt-2"><strong>See:</strong> EMPLOYEE_SHORTFALL_REPORT.md for full implementation details</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ReportSection
        title="Employee Cash Shortfall Analysis"
        description="Track which employees reported shortfalls and the trend over the selected period"
        isLoading={shortfallLoading}
        loadingText="Loading employee shortfall data..."
        isEmpty={employeeShortfalls.length === 0 && endpointAvailable}
        emptyState={{
          icon: CheckCircle2,
          title: 'No Shortfalls',
          description: 'No cash shortfalls recorded for the selected period.',
        }}
      >
        {!endpointAvailable ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Feature Not Yet Available</h3>
            <p className="text-slate-600 mb-4 max-w-md mx-auto">
              The backend endpoint for employee shortfall analysis has not been implemented yet. 
              Check the documentation to set it up.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                icon={TrendingDown}
                label="Total Shortfall"
                value={`₹${safeToFixed(summaryStats.totalShortfall, 2)}`}
                trend={summaryStats.totalShortfall > 0 ? 'negative' : 'neutral'}
                className={summaryStats.totalShortfall > 0 ? 'border-red-200 bg-red-50' : ''}
              />
              <StatCard
                icon={Users}
                label="Employees Affected"
                value={`${summaryStats.employeesAffected}`}
                className="border-amber-200 bg-amber-50"
              />
              <StatCard
                icon={AlertCircle}
                label="Avg per Employee"
                value={`₹${safeToFixed(summaryStats.averageShortfallPerEmployee, 2)}`}
                className="border-orange-200 bg-orange-50"
              />
              {summaryStats.highestShortfallEmployee && (
                <StatCard
                  icon={AlertCircle}
                  label="Highest Shortfall"
                  value={summaryStats.highestShortfallEmployee.employeeName}
                  subtitle={`₹${safeToFixed(summaryStats.highestShortfallEmployee.totalShortfall, 2)}`}
                  className="border-red-200 bg-red-50"
                />
              )}
            </div>

            {/* Employee Shortfall Table */}
            {employeeShortfalls.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-red-600" />
                    Employee Shortfall Breakdown
                  </CardTitle>
                  <CardDescription>
                    Sorted by highest to lowest shortfall amount
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 font-semibold text-slate-700">Employee</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-700">Total Shortfall</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-700">Days with Shortfall</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-700">Avg / Day</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-700">Settlements</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeShortfalls
                          .sort((a, b) => b.totalShortfall - a.totalShortfall)
                          .map((emp, idx) => (
                            <tr
                              key={idx}
                              className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                                emp.totalShortfall > 0 ? 'bg-red-50' : ''
                              }`}
                            >
                              <td className="py-3 px-3">
                                <div className="font-medium text-slate-900">{emp.employeeName}</div>
                              </td>
                              <td className="text-right py-3 px-3">
                                <div className="font-bold text-red-600">
                                  ₹{safeToFixed(emp.totalShortfall, 2)}
                                </div>
                              </td>
                              <td className="text-right py-3 px-3">
                                <div className="text-slate-600">{emp.daysWithShortfall} days</div>
                              </td>
                              <td className="text-right py-3 px-3">
                                <div className="text-orange-600 font-semibold">
                                  ₹{safeToFixed(emp.averagePerDay, 2)}
                                </div>
                              </td>
                              <td className="text-right py-3 px-3">
                                <div className="text-slate-600">{emp.settlementsCount}</div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </ReportSection>
    </>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function Reports() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [selectedStation, setSelectedStation] = useState<string>('all');

  // Fetch stations
  const { data: stationsResponse } = useStations();
  const stations = stationsResponse?.data ?? [];

  // Auto-select station for users with only one station (like managers)
  useEffect(() => {
    if (stations.length === 1 && selectedStation === 'all') {
      setSelectedStation(stations[0].id);
    }
  }, [stations, selectedStation]);

  // Fetch fuel prices for pie chart
  const { prices } = useFuelPricesGlobal();

  // Fetch report data using custom hooks
  const { data: salesReports, isLoading: salesLoading } = useSalesReports({
    dateRange,
    selectedStation,
  });
  const { data: pumpPerformance, isLoading: pumpsLoading } = usePumpPerformance({
    dateRange,
    selectedStation,
  });
  const { data: nozzleBreakdown, isLoading: nozzlesLoading } = useNozzleBreakdown({
    dateRange,
    selectedStation,
  });

  // Aggregate raw readings into sales reports if needed
  const aggregatedSalesReports = useMemo(() => {
    if (!salesReports || salesReports.length === 0) return [];
    
    const firstReport = salesReports[0];
    
    // Check if data is already in aggregated SalesReport format
    // Aggregated format has: totalSales, totalQuantity, totalTransactions (camelCase)
    // Raw format has: totalAmount, deltaVolumeL, readingDate (camelCase after apiClient conversion)
    const hasAggregatedFormat = 'totalSales' in firstReport && 'totalQuantity' in firstReport;
    const hasRawFormat = 'totalAmount' in firstReport || 'deltaVolumeL' in firstReport;
    
    if (hasAggregatedFormat) {
      return salesReports;
    }
    
    if (hasRawFormat) {
      return aggregateRawReadingsToSalesReports(salesReports);
    }
    
    // Fallback: treat as raw format
    return aggregateRawReadingsToSalesReports(salesReports);
  }, [salesReports]);

  // Calculate totals
  const totals = calculateSalesTotals(aggregatedSalesReports);



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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="container mx-auto p-2 page-container space-y-4">
        {/* Header */}
        <ReportHeader
          title="Reports & Analytics"
          subtitle="Comprehensive insights into your fuel station performance"
          icon={BarChart3}
        />

        {/* Filters */}
        <FilterBar
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          selectedStation={selectedStation}
          onStationChange={setSelectedStation}
          stations={Array.isArray(stations) ? stations : []}
        />

        {/* Key Metrics */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Revenue"
            value={`₹${totals.sales.toLocaleString('en-IN')}`}
            trend={{ value: 12.5, direction: 'up' }}
            icon={IndianRupee}
            variant="green"
          />
          <StatCard
            title="Fuel Dispensed"
            value={`${safeToFixed(totals.quantity, 1)}L`}
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

        {/* Analytics Tabs */}
        <div className="space-y-3">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5 gap-1 bg-slate-100 p-1 rounded-lg h-auto md:h-auto overflow-x-auto">
              <TabsTrigger
                value="overview"
                className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2 whitespace-nowrap"
              >
                <PieChart className="w-4 h-4 text-purple-600 data-[state=active]:text-purple-700" />
                <span className="text-[10px] md:text-sm leading-tight">Overview</span>
              </TabsTrigger>
              <TabsTrigger
                value="sales"
                className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2 whitespace-nowrap"
              >
                <BarChart3 className="w-4 h-4 text-blue-600 data-[state=active]:text-blue-700" />
                <span className="text-[10px] md:text-sm leading-tight">Sales</span>
              </TabsTrigger>
              <TabsTrigger
                value="nozzles"
                className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2 whitespace-nowrap"
              >
                <Droplet className="w-4 h-4 text-cyan-600 data-[state=active]:text-cyan-700" />
                <span className="text-[10px] md:text-sm leading-tight">Nozzles</span>
              </TabsTrigger>
              <TabsTrigger
                value="pumps"
                className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2 whitespace-nowrap"
              >
                <Activity className="w-4 h-4 text-orange-600 data-[state=active]:text-orange-700" />
                <span className="text-[10px] md:text-sm leading-tight">Pumps</span>
              </TabsTrigger>
              <TabsTrigger
                value="employees"
                className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2 whitespace-nowrap"
              >
                <Users className="w-4 h-4 text-red-600 data-[state=active]:text-red-700" />
                <span className="text-[10px] md:text-sm leading-tight">Shortfall</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-2 md:space-y-3">
              <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <RevenueTrendChart
                  salesReports={aggregatedSalesReports}
                  isLoading={salesLoading}
                  className="md:col-span-2"
                />
                {/* FuelDistribution removed as requested */}
              </div>
            </TabsContent>

            {/* Sales Tab */}
            <TabsContent value="sales" className="space-y-2">
              <ReportSection
                title="Sales"
                description="By station & fuel type"
                isLoading={salesLoading}
                loadingText="Loading sales reports..."
                isEmpty={!aggregatedSalesReports || aggregatedSalesReports.length === 0}
                emptyState={{
                  icon: FileText,
                  title: 'No Sales Data',
                  description: 'No sales found for the selected date range and filters',
                }}
                onPrintPdf={() => handlePrintPdf('sales')}
              >
                <div>
                  {/* Grand Total Card */}
                  <Card className="mb-3 md:mb-4">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm md:text-lg">Grand Total</CardTitle>
                          <CardDescription className="text-xs md:text-sm">
                            All stations, selected period
                          </CardDescription>
                        </div>
                        <div className="text-right ml-2">
                          <div className="text-lg md:text-2xl font-bold text-green-600">
                            ₹{totals.sales.toLocaleString('en-IN')}
                          </div>
                          <p className="text-xs md:text-sm text-muted-foreground">
                            {safeToFixed(totals.quantity)} L
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {totals.transactions} txns
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                  <div className="space-y-2">
                    {(aggregatedSalesReports ?? []).map((report) => (
                      <SalesReportCard
                        key={`${report.stationId}-${report.date}`}
                        report={report}
                      />
                    ))}
                  </div>
                </div>
              </ReportSection>
            </TabsContent>

            {/* Nozzles Tab */}
            <TabsContent value="nozzles" className="space-y-2">
              <ReportSection
                title="Nozzle Sales"
                description="Performance by nozzle"
                isLoading={nozzlesLoading}
                loadingText="Loading nozzle data..."
                isEmpty={!nozzleBreakdown || nozzleBreakdown.length === 0}
                emptyState={{
                  icon: Droplet,
                  title: 'No Nozzle Data',
                  description: 'No nozzle sales data found for the selected period',
                }}
                onPrintPdf={() => handlePrintPdf('nozzles')}
              >
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {(nozzleBreakdown ?? []).map((nozzle: any) => (
                    <NozzleCard key={nozzle.nozzleId} nozzle={nozzle} />
                  ))}
                </div>
              </ReportSection>
            </TabsContent>

            {/* Pumps Tab */}
            <TabsContent value="pumps" className="space-y-4">
              <ReportSection
                title="Pumps"
                description="Performance by pump & nozzle"
                isLoading={pumpsLoading}
                loadingText="Loading pump performance..."
                isEmpty={!pumpPerformance || pumpPerformance.length === 0}
                emptyState={{
                  icon: Activity,
                  title: 'No Pump Data',
                  description: 'No pump performance data found for the selected filters',
                }}
                onPrintPdf={() => handlePrintPdf('pumps')}
              >
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                  {(pumpPerformance ?? []).map((pump) => (
                    <PumpCard
                      key={pump.pumpId || `${pump.pumpName}-${pump.pumpNumber}`}
                      pump={pump}
                      className="h-fit"
                    />
                  ))}
                </div>
              </ReportSection>
            </TabsContent>

            {/* Employee Shortfall Tab */}
            <TabsContent value="employees" className="space-y-4">
              <EmployeeShortfallReport
                dateRange={dateRange}
                selectedStation={selectedStation}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
