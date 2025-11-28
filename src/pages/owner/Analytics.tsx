/**
 * Owner Analytics Dashboard
 * Visual analytics with charts and trends
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Droplet,
  Users,
  PieChart,
  BarChart3
} from 'lucide-react';

interface Station {
  id: string;
  name: string;
  code: string;
}

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

export default function Analytics() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [dateRange, setDateRange] = useState({
    startDate: thirtyDaysAgo,
    endDate: today
  });
  const [selectedStation, setSelectedStation] = useState<string>('all');

  // Fetch stations
  const { data: stations } = useQuery({
    queryKey: ['owner-stations'],
    queryFn: async () => {
      const response = await apiClient.get<Station[]>('/stations');
      return response;
    }
  });

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
      const response = await apiClient.get<AnalyticsData>(`/dashboard/owner/analytics?${params.toString()}`);
      return response;
    }
  });

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
  const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Insights and trends across all your stations
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="station">Station</Label>
              <Select value={selectedStation} onValueChange={setSelectedStation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stations</SelectItem>
                  {stations?.map((station) => (
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
            <div className="text-center text-muted-foreground">Loading analytics...</div>
          </CardContent>
        </Card>
      ) : analytics ? (
        <>
          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(analytics.overview.totalSales)}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {analytics.overview.salesGrowth >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className={analytics.overview.salesGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatPercentage(analytics.overview.salesGrowth)}
                  </span>
                  <span className="text-muted-foreground">vs last period</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
                <Droplet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.overview.totalQuantity.toFixed(2)} L
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {analytics.overview.quantityGrowth >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className={analytics.overview.quantityGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatPercentage(analytics.overview.quantityGrowth)}
                  </span>
                  <span className="text-muted-foreground">vs last period</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.overview.totalTransactions.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Avg: {formatCurrency(analytics.overview.averageTransaction)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Transaction</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(analytics.overview.averageTransaction)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per transaction
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Sales by Station */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  <CardTitle>Sales by Station</CardTitle>
                </div>
                <CardDescription>Revenue distribution across stations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.salesByStation.map((station, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{station.stationName}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(station.sales)} ({station.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${station.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Sales by Fuel Type */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Droplet className="w-5 h-5" />
                  <CardTitle>Sales by Fuel Type</CardTitle>
                </div>
                <CardDescription>Revenue distribution by fuel category</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analytics.salesByFuelType.map((fuel, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge>{fuel.fuelType.toUpperCase()}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {fuel.quantity.toFixed(2)} L
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {formatCurrency(fuel.sales)} ({fuel.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${fuel.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Top Performing Stations */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                <CardTitle>Top Performing Stations</CardTitle>
              </div>
              <CardDescription>Highest revenue generating stations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.topPerformingStations.map((station, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-medium">{station.stationName}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(station.sales)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {station.growth >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`font-medium ${station.growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatPercentage(station.growth)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Employee Performance */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <CardTitle>Employee Performance</CardTitle>
              </div>
              <CardDescription>Top performing employees by sales</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.employeePerformance.map((employee, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-muted rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{employee.employeeName}</div>
                      <div className="text-sm text-muted-foreground">
                        {employee.shifts} shifts • Avg: {formatCurrency(employee.averageSales)}/shift
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(employee.totalSales)}</div>
                      <div className="text-sm text-muted-foreground">Total Sales</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Daily Trend Chart (Simple Text-based representation) */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                <CardTitle>Daily Sales Trend</CardTitle>
              </div>
              <CardDescription>Last {analytics.dailyTrend.length} days performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.dailyTrend.slice(-7).map((day, idx) => {
                  const maxSales = Math.max(...analytics.dailyTrend.map(d => d.sales));
                  const percentage = (day.sales / maxSales) * 100;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{day.date}</span>
                        <span className="font-medium">{formatCurrency(day.sales)}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {day.quantity.toFixed(2)} L • {day.transactions} txns
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Analytics Data</h3>
              <p className="text-muted-foreground">
                No data available for the selected date range
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
