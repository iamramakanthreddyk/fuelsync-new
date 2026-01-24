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
  printShortfallReport,
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
  AlertTriangle,
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
  shortfallDates?: string[]; // ISO date strings (YYYY-MM-DD) - optional, for future backend enhancement
  lastShortfallDate?: string; // Most recent shortfall date - optional, for future backend enhancement
  employeeId?: string; // Optional employee ID from backend
}

interface EmployeeShortfallReportProps {
  dateRange: DateRange;
  selectedStation: string;
  toast: ReturnType<typeof useToast>['toast'];
}

const EmployeeShortfallReport: React.FC<EmployeeShortfallReportProps> = ({
  dateRange,
  selectedStation,
  toast,
}) => {
  const [endpointAvailable, setEndpointAvailable] = React.useState(true);


  // Fetch shortfall data from backend
  const { data: shortfallData, isLoading: shortfallLoading } = useQuery({
    queryKey: ['employee-shortfalls', selectedStation, dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      // Defensive checks
      const hasValidDates = dateRange?.startDate && dateRange?.endDate;
      const hasValidStation = selectedStation && selectedStation !== '';
      
      
      if (!hasValidStation || !hasValidDates) {
        console.warn('[EmployeeShortfallReport] Missing required params:', { selectedStation, dateRange });
        return [];
      }
      
      try {
        
        const response = await apiClient.get<any>(
          `/stations/${selectedStation}/employee-shortfalls`,
          {
            params: {
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
            },
          }
        );
        
        
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
                  <div className="mt-2"><strong>See:</strong> EMPLOYEE_SHORTFALL_API_SPEC.md for full implementation details</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {employeeShortfalls.length > 0 && !shortfallLoading && !employeeShortfalls[0].lastShortfallDate && (
        <Card className="border-blue-200 bg-blue-50 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Enhanced Date Tracking Coming Soon</h3>
                <p className="text-sm text-blue-800">
                  The backend API currently provides shortfall totals. To see specific dates when shortfalls occurred, the backend needs to include <code className="bg-white px-2 py-1 rounded text-blue-700 font-mono text-xs">lastShortfallDate</code> and <code className="bg-white px-2 py-1 rounded text-blue-700 font-mono text-xs">shortfallDates[]</code> in the response.
                </p>
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
        onPrintPdf={() => {
          if (employeeShortfalls?.length) {
            printShortfallReport(employeeShortfalls, dateRange, () => {
              toast({
                title: 'Popup blocked',
                description: 'Please allow popups to use Print/PDF export.',
              });
            });
          }
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
                title="Total Cash Loss"
                value={`₹${safeToFixed(summaryStats.totalShortfall, 2)}`}
                trend={summaryStats.totalShortfall > 0 ? { value: 0, direction: 'down' as const } : { value: 0, direction: 'neutral' as const }}
                className="border-slate-200 bg-white"
              />
              <StatCard
                icon={Users}
                title="Employees Involved"
                value={`${summaryStats.employeesAffected}`}
                className="border-slate-200 bg-white"
              />
              <StatCard
                icon={AlertCircle}
                title="Avg Days with Loss"
                value={`${safeToFixed(employeeShortfalls.reduce((sum, emp) => sum + emp.daysWithShortfall, 0) / employeeShortfalls.length || 0, 1)}`}
                className="border-slate-200 bg-white"
              />
              {summaryStats.highestShortfallEmployee && (
                <StatCard
                  icon={AlertTriangle}
                  title="Worst Performer"
                  value={summaryStats.highestShortfallEmployee.employeeName}
                  className="border-slate-200 bg-white"
                />
              )}
            </div>

            {/* Employee Shortfall Table - Responsive */}
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
                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 font-semibold text-slate-700">Employee</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-700">Total Shortfall</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-700">Days with Shortfall</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-700">Avg / Day</th>
                          {employeeShortfalls[0]?.lastShortfallDate && (
                            <th className="text-right py-2 px-3 font-semibold text-slate-700">Last Shortfall Date</th>
                          )}
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
                              {emp.lastShortfallDate && (
                                <td className="text-right py-3 px-3">
                                  <div 
                                    className="text-slate-600 text-sm cursor-help border-b border-dotted border-slate-300 w-fit ml-auto"
                                    title={`All shortfall dates: ${emp.shortfallDates?.map(d => new Date(d).toLocaleDateString('en-IN')).join(', ')}`}
                                  >
                                    {new Date(emp.lastShortfallDate).toLocaleDateString('en-IN')}
                                  </div>
                                </td>
                              )}
                              <td className="text-right py-3 px-3">
                                <div className="text-slate-600">{emp.settlementsCount}</div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile Summary Card with List - Only one card rendered */}
                  <div className="sm:hidden">
                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-2">
                      <div className="font-semibold text-slate-800 text-base mb-2">Employee Shortfall Breakdown</div>
                      <div>
                        {employeeShortfalls
                          .sort((a, b) => b.totalShortfall - a.totalShortfall)
                          .map((emp, idx, arr) => (
                            <div key={idx}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-slate-900 text-sm">{emp.employeeName}</span>
                                <span className="font-bold text-slate-700 text-sm">₹{safeToFixed(emp.totalShortfall, 2)}</span>
                              </div>
                              <div className="flex flex-wrap text-xs text-slate-600 gap-x-4 gap-y-1 mb-2">
                                <div><span className="font-semibold">Days:</span> {emp.daysWithShortfall}</div>
                                <div><span className="font-semibold">Avg/Day:</span> ₹{safeToFixed(emp.averagePerDay, 2)}</div>
                                {emp.lastShortfallDate && (
                                  <div>
                                    <span className="font-semibold">Last Date:</span>{' '}
                                    <span 
                                      title={emp.shortfallDates?.map(d => new Date(d).toLocaleDateString('en-IN')).join(', ')}
                                      className="cursor-help border-b border-dotted border-slate-400"
                                    >
                                      {new Date(emp.lastShortfallDate).toLocaleDateString('en-IN')}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {idx < arr.length - 1 && (
                                <div className="border-t border-slate-100 my-2" />
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
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
  const stations = (stationsResponse as any)?.data ?? [];

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
            className="bg-white border-slate-200 text-slate-900"
          />
          <StatCard
            title="Fuel Dispensed"
            value={`${safeToFixed(totals.quantity, 1)}L`}
            trend={{ value: 8.2, direction: 'up' }}
            icon={Droplet}
            className="bg-white border-slate-200 text-slate-900"
          />
          <StatCard
            title="Transactions"
            value={totals.transactions.toString()}
            trend={{ value: 15.3, direction: 'up' }}
            icon={Activity}
            className="bg-white border-slate-200 text-slate-900"
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
                  {(pumpPerformance ?? []).map((pump: any) => (
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
                toast={toast}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
