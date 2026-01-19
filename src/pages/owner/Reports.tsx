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
            <TabsList className="grid w-full grid-cols-5 bg-slate-100 p-1 rounded-lg h-12 md:h-auto">
              <TabsTrigger
                value="overview"
                className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2"
              >
                <PieChart className="w-4 h-4 text-purple-600 data-[state=active]:text-purple-700" />
                <span className="text-[10px] md:text-sm leading-tight">Overview</span>
              </TabsTrigger>
              <TabsTrigger
                value="sales"
                className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2"
              >
                <BarChart3 className="w-4 h-4 text-blue-600 data-[state=active]:text-blue-700" />
                <span className="text-[10px] md:text-sm leading-tight">Sales</span>
              </TabsTrigger>
              <TabsTrigger
                value="nozzles"
                className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2"
              >
                <Droplet className="w-4 h-4 text-cyan-600 data-[state=active]:text-cyan-700" />
                <span className="text-[10px] md:text-sm leading-tight">Nozzles</span>
              </TabsTrigger>
              <TabsTrigger
                value="pumps"
                className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2"
              >
                <Activity className="w-4 h-4 text-orange-600 data-[state=active]:text-orange-700" />
                <span className="text-[10px] md:text-sm leading-tight">Pumps</span>
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}
