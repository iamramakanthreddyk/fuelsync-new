import React, { useMemo } from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useVarianceSummary } from '@/hooks/useVarianceSummary';
import { safeToFixed, formatPercentage } from '@/lib/format-utils';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Activity,
  Droplet,
  Users,
  Award,
  AlertCircle
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface AnalyticsTabProps {
  analyticsData?: {
    overview: {
      totalSales: number;
      totalQuantity: number;
      totalTransactions: number;
      averageTransaction: number;
      salesGrowth: number;
      quantityGrowth: number;
    };
    salesByStation: Array<{
      stationId: string;
      stationName: string;
      sales: number;
      percentage: number;
    }>;
    dailyTrend: Array<{
      date: string;
      sales: number;
      quantity: number;
      transactions: number;
    }>;
    topPerformingStations: Array<{
      stationId: string;
      stationName: string;
      sales: number;
      growth: number;
    }>;
    employeePerformance: Array<{
      employeeId: string;
      employeeName: string;
      shifts: number;
      totalSales: number;
      averageSales: number;
    }>;
  };
  isLoading: boolean;
  dateRange: { startDate: string; endDate: string };
  selectedStation: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' && String(entry.name || '').includes('Sales')
              ? `₹${entry.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
              : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  analyticsData,
  isLoading,
  dateRange,
  selectedStation,
}) => {
  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const formatLitres = (litres: number) => `${safeToFixed(litres, 0)} L`;

  // Fetch variance summary - only when a specific station is selected
  const { data: varianceSummary } = useVarianceSummary(
    selectedStation !== 'all' ? selectedStation : undefined,
    dateRange.startDate,
    dateRange.endDate
  );

  if (isLoading) {
    return (
      <TabsContent value="analytics" className="space-y-4">
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">Loading analytics...</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  if (!analyticsData) {
    return (
      <TabsContent value="analytics" className="space-y-4">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Activity className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Analytics Data</h3>
              <p className="text-muted-foreground text-sm">
                No data available for the selected date range
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="analytics" className="space-y-4 md:space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Sales</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold truncate">
              {formatCurrency(analyticsData?.overview?.totalSales ?? 0)}
            </div>
            <div className="flex items-center gap-1 text-xs mt-1">
              {(analyticsData?.overview?.salesGrowth ?? 0) >= 0 ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              <span className={(analyticsData?.overview?.salesGrowth ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                {formatPercentage(analyticsData?.overview?.salesGrowth ?? 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Quantity</CardTitle>
            <Droplet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold truncate">
              {formatLitres(analyticsData?.overview?.totalQuantity ?? 0)}
            </div>
            <div className="flex items-center gap-1 text-xs mt-1">
              {(analyticsData?.overview?.quantityGrowth ?? 0) >= 0 ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              <span className={(analyticsData?.overview?.quantityGrowth ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                {formatPercentage(analyticsData?.overview?.quantityGrowth ?? 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Transactions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold">
              {(analyticsData?.overview?.totalTransactions ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total count
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Avg/Txn</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold truncate">
              {formatCurrency(analyticsData?.overview?.averageTransaction ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Chart */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <CardTitle className="text-base sm:text-lg">Sales Trend</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {(analyticsData?.dailyTrend?.length ?? 0)} days
            </Badge>
          </div>
          <CardDescription className="text-xs sm:text-sm">Daily performance over time</CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6 pb-4">
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={analyticsData?.dailyTrend ?? []}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `₹${safeToFixed(value / 1000, 0)}K`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `${safeToFixed(value / 1000, 0)}K L`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="sales"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSales)"
                name="Sales (₹)"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="quantity"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorQuantity)"
                name="Quantity (L)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Variance Analysis Chart */}
      {varianceSummary && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle
                  className={`w-5 h-5 ${
                    varianceSummary.totalVariance > 0
                      ? 'text-red-600'
                      : varianceSummary.totalVariance < 0
                        ? 'text-yellow-600'
                        : 'text-green-600'
                  }`}
                />
                <CardTitle className="text-base sm:text-lg">Variance Analysis</CardTitle>
              </div>
              <Badge
                className={`text-xs font-bold ${
                  varianceSummary.totalVariance > 0
                    ? 'bg-red-600'
                    : varianceSummary.totalVariance < 0
                      ? 'bg-yellow-600'
                      : 'bg-green-600'
                } text-white`}
              >
                {varianceSummary.totalVariance > 0
                  ? '🚨 SHORTFALL'
                  : varianceSummary.totalVariance < 0
                    ? '⚠️ OVERAGE'
                    : '✓ BALANCED'}
              </Badge>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {varianceSummary.totalVariance > 0
                ? `Missing: ₹${Math.abs(varianceSummary.totalVariance).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${safeToFixed(Math.abs(varianceSummary.variancePercentage), 2)}% shortfall)`
                : varianceSummary.totalVariance < 0
                  ? `Extra: ₹${Math.abs(varianceSummary.totalVariance).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${safeToFixed(Math.abs(varianceSummary.variancePercentage), 2)}% overage)`
                  : 'Perfect match - no variance'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6 pb-4 space-y-4">
            {/* Explanation */}
            <div
              className={`p-3 rounded-lg text-sm font-medium ${
                varianceSummary.totalVariance > 0
                  ? 'bg-red-100 text-red-900 border border-red-300'
                  : varianceSummary.totalVariance < 0
                    ? 'bg-yellow-100 text-yellow-900 border border-yellow-300'
                    : 'bg-green-100 text-green-900 border border-green-300'
              }`}
            >
              <div className="font-bold mb-1">
                {varianceSummary.totalVariance > 0
                  ? '⚠️ SHORTFALL - Cash Missing'
                  : varianceSummary.totalVariance < 0
                    ? '📊 OVERAGE - Extra Cash'
                    : '✓ BALANCED - All Matched'}
              </div>
              <div className="text-xs">
                {varianceSummary.totalVariance > 0
                  ? `Expected ₹${safeToFixed(varianceSummary.totalExpectedCash, 0)} from readings but received only ₹${safeToFixed(varianceSummary.totalExpectedCash - varianceSummary.totalVariance, 0)}`
                  : varianceSummary.totalVariance < 0
                    ? `Expected ₹${safeToFixed(varianceSummary.totalExpectedCash, 0)} from readings but received ₹${safeToFixed(varianceSummary.totalExpectedCash - varianceSummary.totalVariance, 0)}`
                    : `Received exactly ₹${safeToFixed(varianceSummary.totalExpectedCash, 0)} as expected`}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-2">
              <div
                className={`p-2 sm:p-3 rounded border-2 ${
                  varianceSummary.totalVariance > 0
                    ? 'bg-red-50 border-red-200'
                    : varianceSummary.totalVariance < 0
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-green-50 border-green-200'
                }`}
              >
                <div className="text-xs text-muted-foreground font-bold">VARIANCE</div>
                <div
                  className={`text-sm sm:text-lg font-bold ${
                    varianceSummary.totalVariance > 0
                      ? 'text-red-700'
                      : varianceSummary.totalVariance < 0
                        ? 'text-yellow-700'
                        : 'text-green-700'
                  }`}
                >
                  ₹{Math.abs(varianceSummary.totalVariance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="p-2 sm:p-3 rounded border-2 border-purple-200 bg-purple-50">
                <div className="text-xs text-muted-foreground font-bold">AVG/DAY</div>
                <div className="text-sm sm:text-lg font-bold text-purple-700">
                  ₹{Math.abs(varianceSummary.avgDailyVariance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="p-2 sm:p-3 rounded border-2 border-blue-200 bg-blue-50">
                <div className="text-xs text-muted-foreground font-bold">DAYS</div>
                <div className="text-sm sm:text-lg font-bold text-blue-700">
                  {varianceSummary.dayCount}
                </div>
              </div>
            </div>

            {/* Variance Chart */}
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={varianceSummary.byDay}>
                <defs>
                  <linearGradient id="colorVariance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `₹${safeToFixed(value / 1000, 0)}K`} />
                <Tooltip
                  formatter={(value: number) =>
                    `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                  }
                  contentStyle={{ fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="variance"
                  stroke="#dc2626"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorVariance)"
                  name="Variance (₹)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Sales by Station - Pie Chart */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">Sales by Station</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Revenue distribution</CardDescription>
        </CardHeader>
        <CardContent>
          {(analyticsData?.salesByStation?.length ?? 0) === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No station sales data
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analyticsData?.salesByStation ?? []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ stationName, percentage }: any) => {
                      const truncatedName =
                        stationName.length > 15 ? stationName.substring(0, 15) + '...' : stationName;
                      return `${truncatedName} (${safeToFixed(percentage, 0)}%)`;
                    }}
                    outerRadius={window.innerWidth < 640 ? 80 : 100}
                    fill="#8884d8"
                    dataKey="sales"
                  >
                    {(analyticsData?.salesByStation ?? []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                {(analyticsData?.salesByStation ?? []).map((station: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="truncate">{station.stationName}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Top Performing Stations */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            <CardTitle className="text-base sm:text-lg">Top Performing Stations</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">Highest revenue generators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(analyticsData?.topPerformingStations ?? []).map((station: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-muted to-background rounded-lg border hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shadow-md ${
                      idx === 0
                        ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white'
                        : idx === 1
                          ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white'
                          : idx === 2
                            ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
                            : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{station.stationName}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      {formatCurrency(station.sales)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {station.growth >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <Badge variant={station.growth >= 0 ? 'default' : 'destructive'} className="text-xs">
                    {formatPercentage(station.growth)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Employee Performance */}
      {(analyticsData?.employeePerformance?.length ?? 0) > 0 && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <CardTitle className="text-base sm:text-lg">Employee Performance</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">Top performers by sales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(analyticsData?.employeePerformance ?? []).map((employee: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-transparent rounded-lg border hover:shadow-md transition-shadow"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm truncate">{employee.employeeName}</div>
                      {idx < 3 && (
                        <Badge variant="secondary" className="text-xs">
                          Top {idx + 1}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {employee.shifts} shifts
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Avg: {formatCurrency(employee.averageSales)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="font-bold text-sm sm:text-base text-blue-600">
                      {formatCurrency(employee.totalSales)}
                    </div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </TabsContent>
  );
};
