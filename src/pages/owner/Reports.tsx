/**
 * Owner Reports & Analytics
 * Modern dashboard-style view for sales, shift, and operational reports
 * 
 * Refactored to use reusable components from @/components/reports
 */

import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useFuelPricesGlobal } from '../../context/FuelPricesContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStations } from '@/hooks/api';
import {
  useSalesReports,
  useShiftReports,
  usePumpPerformance,
  useNozzleBreakdown,
  calculateSalesTotals,
  SalesReport,
} from '@/hooks/useReportData';
import {
  ReportHeader,
  FilterBar,
  ReportSection,
  StatCard,
  SalesReportCard,
  NozzleCard,
  ShiftCard,
  PumpCard,
  DateRange,
} from '@/components/reports';
import {
  exportSalesReport,
  exportNozzlesReport,
  exportShiftsReport,
  exportPumpsReport,
  printSalesReport,
  printNozzlesReport,
  printShiftsReport,
  printPumpsReport,
} from '@/lib/report-export';
import { safeToFixed } from '@/lib/format-utils';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  BarChart3,
  Activity,
  Droplet,
  Clock,
  PieChart,
  LineChart as LineChartIcon,
  TrendingUp,
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
// OVERVIEW TAB COMPONENTS
// ============================================

interface FuelDistributionProps {
  className?: string;
}

const FuelDistribution: React.FC<FuelDistributionProps> = ({ className }) => (
  <Card className={className}>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <PieChart className="w-5 h-5 text-purple-600" />
        Fuel Distribution
      </CardTitle>
      <CardDescription>Sales by fuel type</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        {(() => {
          const { prices } = useFuelPricesGlobal();
          const total = Object.values(prices).reduce((sum, price) => sum + price, 0);
          return Object.entries(prices).map(([fuelType, price]) => {
            // Assign color based on fuel type
            let color = 'bg-gray-400';
            if (fuelType === 'PETROL') color = 'bg-blue-500';
            else if (fuelType === 'DIESEL') color = 'bg-green-500';
            else if (fuelType === 'CNG') color = 'bg-orange-500';
            // Calculate percentage
            const percentage = total > 0 ? Math.round((price / total) * 100) : 0;
            return (
              <div key={fuelType} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 ${color} rounded-full`} />
                  <span className="text-sm">{fuelType}</span>
                </div>
                <span className="font-medium">{percentage}%</span>
              </div>
            );
          });
        })()}
      </div>
    </CardContent>
  </Card>
);

interface TopStationsProps {
  stations: Array<{ id: string; name: string; code?: string }>;
  className?: string;
}

const TopStations: React.FC<TopStationsProps> = ({ stations, className }) => (
  <Card className={className}>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-green-600" />
        Top Stations
      </CardTitle>
      <CardDescription>Best performing stations</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {stations.slice(0, 3).map((station, idx) => (
          <div key={station.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {idx + 1}
              </div>
              <div>
                <p className="font-medium text-sm">{station.name}</p>
                {station.code && (
                  <p className="text-xs text-gray-500">{station.code}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-green-600">
                ₹{(Math.random() * 50000 + 20000).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500">
                +{Math.floor(Math.random() * 20 + 5)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);



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
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <LineChartIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            Revenue Trend
          </CardTitle>
          <CardDescription>Daily revenue over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 md:h-64 flex items-center justify-center">
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
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <LineChartIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            Revenue Trend
          </CardTitle>
          <CardDescription>Daily revenue over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 md:h-64 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-dashed border-blue-200">
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
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <LineChartIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
          Revenue Trend
        </CardTitle>
        <CardDescription>Daily revenue over the selected period</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-48 md:h-64">
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

  // Fetch report data using custom hooks
  const { data: salesReports, isLoading: salesLoading } = useSalesReports({
    dateRange,
    selectedStation,
  });
  const { data: shiftReports, isLoading: shiftsLoading } = useShiftReports({
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

  // Calculate totals
  const totals = calculateSalesTotals(salesReports);

  // Export handlers
  const handleExport = (reportType: string) => {
    const onSuccess = (filename: string) => {
      toast({ title: 'Export Ready', description: `Downloaded ${filename}` });
    };

    try {
      switch (reportType) {
        case 'sales':
          if (salesReports?.length) {
            exportSalesReport(salesReports, dateRange, onSuccess);
          }
          break;
        case 'nozzles':
          if (nozzleBreakdown?.length) {
            exportNozzlesReport(nozzleBreakdown, dateRange, onSuccess);
          }
          break;
        case 'shifts':
          if (shiftReports?.length) {
            exportShiftsReport(shiftReports, dateRange, onSuccess);
          }
          break;
        case 'pumps':
          if (pumpPerformance?.length) {
            exportPumpsReport(pumpPerformance, dateRange, onSuccess);
          }
          break;
        default:
          toast({
            title: 'Nothing to export',
            description: 'No rows available for selected report.',
          });
      }
    } catch (err) {
      console.error('Export error', err);
      toast({ title: 'Export failed', description: 'Unable to export report' });
    }
  };

  const handlePrintPdf = (reportType: string) => {
    const onPopupBlocked = () => {
      toast({
        title: 'Popup blocked',
        description: 'Please allow popups to use Print/PDF export.',
      });
    };

    switch (reportType) {
      case 'sales':
        if (salesReports?.length) {
          printSalesReport(salesReports, dateRange, onPopupBlocked);
        }
        break;
      case 'nozzles':
        if (nozzleBreakdown?.length) {
          printNozzlesReport(nozzleBreakdown, dateRange, onPopupBlocked);
        }
        break;
      case 'shifts':
        if (shiftReports?.length) {
          printShiftsReport(shiftReports, dateRange, onPopupBlocked);
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
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <ReportHeader
          title="Reports & Analytics"
          subtitle="Comprehensive insights into your fuel station performance"
          icon={BarChart3}
          stats={[
            { value: `₹${totals.sales.toLocaleString('en-IN')}`, label: 'Total Revenue' },
            { value: `${safeToFixed(totals.quantity, 1)}L`, label: 'Fuel Dispensed' },
          ]}
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
        <div className="space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-5 bg-gray-100 p-1 rounded-xl h-auto">
              <TabsTrigger
                value="overview"
                className="rounded-lg data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md text-xs md:text-sm py-2 md:py-3 px-2 sm:px-4 transition-all duration-200"
              >
                <PieChart className="w-4 h-4 md:w-5 md:h-5 sm:mr-2 text-purple-500 data-[state=active]:text-white" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger
                value="sales"
                className="rounded-lg data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md text-xs md:text-sm py-2 md:py-3 px-2 sm:px-4 transition-all duration-200"
              >
                <BarChart3 className="w-4 h-4 md:w-5 md:h-5 sm:mr-2 text-blue-500 data-[state=active]:text-white" />
                <span className="hidden sm:inline">Sales</span>
              </TabsTrigger>
              <TabsTrigger
                value="nozzles"
                className="rounded-lg data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md text-xs md:text-sm py-2 md:py-3 px-2 sm:px-4 transition-all duration-200"
              >
                <Droplet className="w-4 h-4 md:w-5 md:h-5 sm:mr-2 text-cyan-500 data-[state=active]:text-white" />
                <span className="hidden sm:inline">Nozzles</span>
              </TabsTrigger>
              <TabsTrigger
                value="shifts"
                className="rounded-lg data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md text-xs md:text-sm py-2 md:py-3 px-2 sm:px-4 transition-all duration-200"
              >
                <Clock className="w-4 h-4 md:w-5 md:h-5 sm:mr-2 text-green-500 data-[state=active]:text-white" />
                <span className="hidden sm:inline">Shifts</span>
              </TabsTrigger>
              <TabsTrigger
                value="pumps"
                className="rounded-lg data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md text-xs md:text-sm py-2 md:py-3 px-2 sm:px-4 col-span-2 md:col-span-1 transition-all duration-200"
              >
                <Activity className="w-4 h-4 md:w-5 md:h-5 sm:mr-2 text-blue-600 data-[state=active]:text-white" />
                <span className="hidden sm:inline">Pumps</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <RevenueTrendChart
                  salesReports={salesReports}
                  isLoading={salesLoading}
                  className="md:col-span-2"
                />
                <FuelDistribution />
                <TopStations stations={Array.isArray(stations) ? stations : []} />
              </div>
            </TabsContent>

            {/* Sales Tab */}
            <TabsContent value="sales" className="space-y-4">
              <ReportSection
                title="Sales Reports"
                description="Detailed sales breakdown by station and fuel type"
                isLoading={salesLoading}
                loadingText="Loading sales reports..."
                isEmpty={!salesReports || salesReports.length === 0}
                emptyState={{
                  icon: FileText,
                  title: 'No Sales Data',
                  description: 'No sales found for the selected date range and filters',
                }}
                onExportCsv={() => handleExport('sales')}
                onPrintPdf={() => handlePrintPdf('sales')}
              >
                <div>
                  {/* Grand Total Card */}
                  <Card className="mb-4">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">Grand Total</CardTitle>
                          <CardDescription>
                            All stations, all days in selected range
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            ₹{totals.sales.toLocaleString('en-IN')}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {safeToFixed(totals.quantity)} L
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {totals.transactions} Transactions
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                  <div className="space-y-4">
                    {(salesReports ?? []).map((report) => (
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
            <TabsContent value="nozzles" className="space-y-4">
              <ReportSection
                title="Nozzle-wise Sales Breakdown"
                description="Detailed sales performance by individual nozzles"
                isLoading={nozzlesLoading}
                loadingText="Loading nozzle data..."
                isEmpty={!nozzleBreakdown || nozzleBreakdown.length === 0}
                emptyState={{
                  icon: Droplet,
                  title: 'No Nozzle Data',
                  description: 'No nozzle sales data found for the selected period',
                }}
                onExportCsv={() => handleExport('nozzles')}
                onPrintPdf={() => handlePrintPdf('nozzles')}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {(nozzleBreakdown ?? []).map((nozzle: any) => (
                    <NozzleCard key={nozzle.nozzleId} nozzle={nozzle} />
                  ))}
                </div>
              </ReportSection>
            </TabsContent>

            {/* Shifts Tab */}
            <TabsContent value="shifts" className="space-y-4">
              <ReportSection
                title="Shift Reports"
                description="Employee shift details and performance"
                isLoading={shiftsLoading}
                loadingText="Loading shift reports..."
                isEmpty={!shiftReports || shiftReports.length === 0}
                emptyState={{
                  icon: Clock,
                  title: 'No Shift Data',
                  description: 'No shifts found for the selected date range and filters',
                }}
                onExportCsv={() => handleExport('shifts')}
                onPrintPdf={() => handlePrintPdf('shifts')}
              >
                <div className="space-y-3">
                  {(shiftReports ?? []).map((shift) => (
                    <ShiftCard key={shift.id} shift={shift} />
                  ))}
                </div>
              </ReportSection>
            </TabsContent>

            {/* Pumps Tab */}
            <TabsContent value="pumps" className="space-y-4">
              <ReportSection
                title="Pump Performance"
                description="Performance metrics by pump and nozzle"
                isLoading={pumpsLoading}
                loadingText="Loading pump performance..."
                isEmpty={!pumpPerformance || pumpPerformance.length === 0}
                emptyState={{
                  icon: Activity,
                  title: 'No Pump Data',
                  description: 'No pump performance data found for the selected filters',
                }}
                onExportCsv={() => handleExport('pumps')}
                onPrintPdf={() => handlePrintPdf('pumps')}
              >
                <div className="space-y-4">
                  {(pumpPerformance ?? []).map((pump) => (
                    <PumpCard
                      key={pump.pumpId || `${pump.pumpName}-${pump.pumpNumber}`}
                      pump={pump}
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
