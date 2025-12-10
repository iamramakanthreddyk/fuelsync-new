/**
 * Owner Reports & Analytics
 * Modern dashboard-style view for sales, shift, and operational reports
 * 
 * Refactored to use reusable components from @/components/reports
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStations } from '@/hooks/api';
import {
  useSalesReports,
  useShiftReports,
  usePumpPerformance,
  useNozzleBreakdown,
  calculateSalesTotals,
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
  DollarSign,
  Activity,
  Droplet,
  Clock,
  Zap,
  PieChart,
  LineChart,
  TrendingUp,
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
        {[
          { name: 'Petrol', percentage: 65, color: 'bg-blue-500' },
          { name: 'Diesel', percentage: 30, color: 'bg-green-500' },
          { name: 'CNG', percentage: 5, color: 'bg-orange-500' },
        ].map((fuel) => (
          <div key={fuel.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 ${fuel.color} rounded-full`} />
              <span className="text-sm">{fuel.name}</span>
            </div>
            <span className="font-medium">{fuel.percentage}%</span>
          </div>
        ))}
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


const PerformanceInsights: React.FC<{ className?: string }> = ({ className }) => {
  const insights = [
    {
      title: 'Peak Hours',
      description:
        'Your station performs best between 6-8 AM and 5-7 PM. Consider staffing adjustments.',
      colorScheme: 'green',
    },
    {
      title: 'Fuel Mix',
      description:
        'Diesel sales are up 15% this month. Consider increasing diesel inventory.',
      colorScheme: 'blue',
    },
    {
      title: 'Price Optimization',
      description:
        'Petrol prices are 2% below market average. Consider a ₹1 increase.',
      colorScheme: 'orange',
    },
    {
      title: 'Efficiency',
      description:
        'Pump utilization is at 78%. Target is 85% for optimal performance.',
      colorScheme: 'purple',
    },
  ];

  const colorStyles: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    green: {
      bg: 'bg-gradient-to-br from-green-50 to-emerald-50',
      border: 'border-green-200',
      text: 'text-green-700',
      dot: 'bg-green-500',
    },
    blue: {
      bg: 'bg-gradient-to-br from-blue-50 to-cyan-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      dot: 'bg-blue-500',
    },
    orange: {
      bg: 'bg-gradient-to-br from-orange-50 to-red-50',
      border: 'border-orange-200',
      text: 'text-orange-700',
      dot: 'bg-orange-500',
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-50 to-violet-50',
      border: 'border-purple-200',
      text: 'text-purple-700',
      dot: 'bg-purple-500',
    },
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Zap className="w-4 h-4 md:w-5 md:h-5 text-yellow-600" />
          Performance Insights
        </CardTitle>
        <CardDescription>AI-powered insights and recommendations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
          {insights.map((insight) => {
            const styles = colorStyles[insight.colorScheme];
            return (
              <div
                key={insight.title}
                className={`p-3 md:p-4 rounded-lg border ${styles.bg} ${styles.border}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 ${styles.dot} rounded-full`} />
                  <span
                    className={`font-medium ${styles.text.replace('700', '800')} text-sm`}
                  >
                    {insight.title}
                  </span>
                </div>
                <p className={`text-xs md:text-sm ${styles.text}`}>
                  {insight.description}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

const RevenueTrendChart: React.FC<{ className?: string }> = ({ className }) => (
  <Card className={className}>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base md:text-lg">
        <LineChart className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
        Revenue Trend
      </CardTitle>
      <CardDescription>Daily revenue over the selected period</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="h-48 md:h-64 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-dashed border-blue-200">
        <div className="text-center p-4">
          <LineChart className="w-10 h-10 md:w-12 md:h-12 mx-auto text-blue-400 mb-3" />
          <p className="text-blue-600 font-medium text-sm md:text-base">
            Revenue Chart
          </p>
          <p className="text-xs md:text-sm text-blue-500">
            Interactive chart will be displayed here
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

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
            icon={DollarSign}
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
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm py-2 md:py-3"
              >
                <PieChart className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="sales"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm py-2 md:py-3"
              >
                <BarChart3 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                Sales
              </TabsTrigger>
              <TabsTrigger
                value="nozzles"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm py-2 md:py-3"
              >
                <Droplet className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                Nozzles
              </TabsTrigger>
              <TabsTrigger
                value="shifts"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm py-2 md:py-3"
              >
                <Clock className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                Shifts
              </TabsTrigger>
              <TabsTrigger
                value="pumps"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm py-2 md:py-3 col-span-2 md:col-span-1"
              >
                <Activity className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                Pumps
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <RevenueTrendChart className="md:col-span-2" />
                <FuelDistribution />
                  <TopStations stations={Array.isArray(stations) ? stations : []} />
                  <PerformanceInsights className="md:col-span-2" />
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
