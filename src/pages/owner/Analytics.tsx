/**
 * Owner Analytics Dashboard
 * Visual analytics with charts and trends
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FuelBadge } from '@/components/FuelBadge';
import { apiClient } from '@/lib/api-client';
import { extractApiData } from '@/lib/api-response';
import { useStations } from '@/hooks/api';
import { getFuelColors } from '@/lib/fuelColors';
import { safeToFixed } from '@/lib/format-utils';
import { Station } from '@/types/api';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Activity,
  Droplet,
  Users,
  BarChart3,
  Award
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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

interface AnalyticsData {
  overview: {
    totalSales: number;
    totalQuantity: number;
    totalTransactions: number;
    averageTransaction: number;
    salesGrowth: number;
    quantityGrowth: number;
  };
  salesByStation: {
    stationId: string;
    stationName: string;
    sales: number;
    percentage: number;
  }[];
  salesByFuelType: {
    fuelType: string;
    sales: number;
    quantity: number;
    percentage: number;
  }[];
  dailyTrend: {
    date: string;
    sales: number;
    quantity: number;
    transactions: number;
  }[];
  topPerformingStations: {
    stationId: string;
    stationName: string;
    sales: number;
    growth: number;
  }[];
  employeePerformance: {
    employeeId: string;
    employeeName: string;
    shifts: number;
    totalSales: number;
    averageSales: number;
  }[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444'];

// Get chart colors from fuel color system
const getFuelChartColor = (fuelType: string): string => {
  const colors = getFuelColors(fuelType);
  const colorMap: Record<string, string> = {
    'petrol': '#22c55e',  // green-500
    'diesel': '#3b82f6',  // blue-500
    'cng': '#a855f7',     // purple-500
    'ev': '#eab308'       // yellow-500
  };
  return colorMap[fuelType.toLowerCase()] || '#6b7280';
};

export default function Analytics() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [dateRange, setDateRange] = useState({
    startDate: thirtyDaysAgo,
    endDate: today
  });
  const [selectedStation, setSelectedStation] = useState<string>('all');

  // Quick date presets
  const setQuickRange = (days: number) => {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    setDateRange({ startDate: start, endDate: end });
  };

  // Fetch stations
  const {
    data: stationsResponse
  } = useStations();

  const stations = stationsResponse?.data;

  // Fetch analytics data
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics', dateRange, selectedStation],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      if (selectedStation !== 'all') {
        params.append('stationId', selectedStation);
      }
      const response = await apiClient.get(`/dashboard/owner/analytics?${params.toString()}`);
      return extractApiData(response, null);
    }
  });

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${safeToFixed(value, 1)}%`;
  const formatLitres = (litres: number) => `${safeToFixed(litres, 0)} L`;

  // Custom tooltip for charts
  interface TooltipPayloadEntry {
    color?: string;
    name: string;
    value: number | string;
  }
  interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadEntry[];
    label?: string;
  }
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' && String(entry.name || '').includes('Sales')
                ? formatCurrency(Number(entry.value))
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };
  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl pt-6 sm:pt-3 md:pt-0">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Insights and trends across all your stations
        </p>
      </div>

      {/* Filters - Mobile Optimized */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg sm:text-xl">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickRange(7)}
              className="text-xs"
            >
              Last 7 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickRange(30)}
              className="text-xs"
            >
              Last 30 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickRange(90)}
              className="text-xs"
            >
              Last 90 Days
            </Button>
          </div>

          {/* Date and Station Filters */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="startDate" className="text-xs sm:text-sm">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-xs sm:text-sm">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="station" className="text-xs sm:text-sm">Station</Label>
              <Select value={selectedStation} onValueChange={setSelectedStation}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stations</SelectItem>
                  {stations?.map((station: Station) => (
                    <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">Loading analytics...</p>
            </div>
          </CardContent>
        </Card>
      ) : analytics ? (
        <>
          {/* Overview Cards - Mobile Optimized */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-xs sm:text-sm font-medium">Total Sales</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                <div className="text-lg sm:text-2xl font-bold truncate">
                  {formatCurrency(analytics?.overview?.totalSales ?? 0)}
                </div>
                <div className="flex items-center gap-1 text-xs mt-1">
                  {(analytics?.overview?.salesGrowth ?? 0) >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className={(analytics?.overview?.salesGrowth ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatPercentage(analytics?.overview?.salesGrowth ?? 0)}
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
                  {formatLitres(analytics?.overview?.totalQuantity ?? 0)}
                </div>
                <div className="flex items-center gap-1 text-xs mt-1">
                  {(analytics?.overview?.quantityGrowth ?? 0) >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className={(analytics?.overview?.quantityGrowth ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatPercentage(analytics?.overview?.quantityGrowth ?? 0)}
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
                  {(analytics?.overview?.totalTransactions ?? 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total count
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-xs sm:text-sm font-medium">Avg/Txn</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                <div className="text-lg sm:text-2xl font-bold truncate">
                  {formatCurrency(analytics?.overview?.averageTransaction ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per transaction
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Trend Chart - Full Width */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  <CardTitle className="text-base sm:text-lg">Sales Trend</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs">
                  {(analytics?.dailyTrend?.length ?? 0)} days
                </Badge>
              </div>
              <CardDescription className="text-xs sm:text-sm">Daily performance over time</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6 pb-4">
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={analytics?.dailyTrend ?? []}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
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
                  <Legend 
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                    iconType="circle"
                  />
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

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Sales by Station - Pie Chart */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base sm:text-lg">Sales by Station</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Revenue distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {((analytics?.salesByStation?.length ?? 0) === 0) ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No station sales data</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics?.salesByStation ?? []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ stationName, percentage }) =>
                            `${stationName} (${safeToFixed(percentage, 0)}%)`
                          }
                          outerRadius={window.innerWidth < 640 ? 80 : 100}
                          fill="#8884d8"
                          dataKey="sales"
                        >
                          {(analytics?.salesByStation ?? []).map((entry: { stationId: string; stationName: string; sales: number; percentage: number }, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      {(analytics?.salesByStation ?? []).map((station: { stationId: string; stationName: string; sales: number; percentage: number }, idx: number) => (
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

            {/* Sales by Fuel Type - Bar Chart */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Droplet className="w-5 h-5 text-purple-500" />
                  <CardTitle className="text-base sm:text-lg">Sales by Fuel Type</CardTitle>
                </div>
                <CardDescription className="text-xs sm:text-sm">Revenue by category</CardDescription>
              </CardHeader>
              <CardContent>
                {((analytics?.salesByFuelType?.length ?? 0) === 0) ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No fuel type sales data</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics?.salesByFuelType ?? []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="fuelType" tick={{ fontSize: 11 }} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(value) => `₹${safeToFixed(value / 1000, 0)}K`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="sales" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Sales">
                          {(analytics?.salesByFuelType ?? []).map((entry: { fuelType: string; sales: number; quantity: number; percentage: number }, index: number) => (
                            <Cell key={`cell-${index}`} fill={getFuelChartColor(entry.fuelType)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(analytics?.salesByFuelType ?? []).map((fuel: { fuelType: string; sales: number; quantity: number; percentage: number }, idx: number) => (
                        <FuelBadge key={idx} fuelType={fuel.fuelType} showDot />
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Performing Stations - Mobile Optimized */}
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
                {(analytics?.topPerformingStations ?? []).map((station: { stationId: string; stationName: string; sales: number; growth: number }, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-muted to-background rounded-lg border hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shadow-md ${
                        idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' :
                        idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white' :
                        idx === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                        'bg-primary text-primary-foreground'
                      }`}>
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
                      <Badge variant={station.growth >= 0 ? "default" : "destructive"} className="text-xs">
                        {formatPercentage(station.growth)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Employee Performance - Mobile Optimized */}
          {(analytics?.employeePerformance?.length ?? 0) > 0 && (
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
                  {(analytics?.employeePerformance ?? []).map((employee: { employeeId: string; employeeName: string; shifts: number; totalSales: number; averageSales: number }, idx: number) => (
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
        </>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Analytics Data</h3>
              <p className="text-muted-foreground text-sm">
                No data available for the selected date range
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
