/**
 * Income & Receivables Report
 * Comprehensive report showing:
 * - Total liters, calculated sales, cash/online/credit breakdown
 * - Daily settlements with variance
 * - Receivables aging
 * - Creditor settlements
 * - Income statement
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { safeToFixed } from '@/lib/format-utils';
import { useStations } from '@/hooks/api';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, IndianRupee, Droplet, AlertTriangle,
  Calendar, Download, Filter
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface IncomeReportData {
  period: { startDate: string; endDate: string };
  summaryMetrics: {
    totalLiters: number;
    totalSaleValue: number;
    fuelBreakdown: Array<{
      fuelType: string;
      liters: number;
      value: number;
      percentage: string;
    }>;
  };
  incomeBreakdown: {
    calculatedSaleValue: number;
    cashReceived: number;
    onlineReceived: number;
    creditPending: number;
    verification: { total: number; match: boolean };
  };
  settlements: Array<{
    date: string;
    expectedCash: number;
    actualCash: number;
    variance: number;
    variancePercent: number;
    varianceStatus: 'OK' | 'REVIEW' | 'INVESTIGATE';
    notes: string;
  }>;
  settlementSummary: {
    count: number;
    totalVariance: number;
    avgVariancePercent: number;
  };
  receivables: {
    aging: Array<{
      creditorId: string;
      creditorName: string;
      balance: number;
      dueDate: string;
      agingBucket: string;
    }>;
    summary: { totalOutstanding: number; current: number; overdue: number };
  };
  creditorSettlements: Record<string, {
    totalCredited: number;
    totalSettled: number;
    outstanding: number;
    transactions: Array<{ date: string; amount: number; notes: string }>;
  }>;
  incomeStatement: {
    totalSalesGenerated: number;
    lessCreditPending: number;
    lessCashVariance: number;
    netCashIncome: number;
  };
}

const FUEL_COLORS: Record<string, string> = {
  'Diesel': '#EF4444',
  'Petrol': '#F59E0B',
  'CNG': '#3B82F6',
  'LPG': '#8B5CF6',
  'Other': '#6B7280'
};

const getVarianceStatusColor = (status: string) => {
  switch (status) {
    case 'OK': return 'bg-green-100 text-green-800';
    case 'REVIEW': return 'bg-yellow-100 text-yellow-800';
    case 'INVESTIGATE': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getAgingColor = (bucket: string) => {
  switch (bucket) {
    case 'Current': return 'bg-green-50 border-green-200';
    case 'Overdue': return 'bg-orange-50 border-orange-200';
    case 'Over30Days': return 'bg-red-50 border-red-200';
    case 'Over60Days': return 'bg-red-100 border-red-300';
    default: return 'bg-gray-50 border-gray-200';
  }
};

export default function IncomeReport() {
  const { toast } = useToast();
  const { data: stationsResponse } = useStations();
  const stations = stationsResponse?.data || [];

  const [selectedStation, setSelectedStation] = useState<string>(
    stations[0]?.id || ''
  );
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [viewType, setViewType] = useState<'daily' | 'monthly' | 'yearly'>('daily');

  // Auto-update dates based on view type
  const handleViewTypeChange = (type: 'daily' | 'monthly' | 'yearly') => {
    setViewType(type);
    const today = new Date();
    
    if (type === 'daily') {
      const dateStr = today.toISOString().split('T')[0];
      setDateRange({ startDate: dateStr, endDate: dateStr });
    } else if (type === 'monthly') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setDateRange({
        startDate: firstDay.toISOString().split('T')[0],
        endDate: lastDay.toISOString().split('T')[0]
      });
    } else if (type === 'yearly') {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      const lastDay = new Date(today.getFullYear(), 11, 31);
      setDateRange({
        startDate: firstDay.toISOString().split('T')[0],
        endDate: lastDay.toISOString().split('T')[0]
      });
    }
  };

  // Fetch report data
  const { data: reportData, isLoading, error } = useQuery({
    queryKey: ['income-report', selectedStation, dateRange],
    queryFn: async () => {
      if (!selectedStation) return null;
      const params = new URLSearchParams({
        stationId: selectedStation,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      const response = await apiClient.get<{ success: boolean; data: IncomeReportData }>(
        `/dashboard/income-receivables?${params.toString()}`
      );
      return response?.data;
    },
    enabled: !!selectedStation
  });

  const handleExportCSV = () => {
    if (!reportData) return;

    const csv = [
      ['INCOME & RECEIVABLES REPORT'],
      [`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`],
      [],
      ['SUMMARY METRICS'],
      [`Total Liters: ${reportData.summaryMetrics.totalLiters}`],
      [`Total Sale Value: ₹${reportData.summaryMetrics.totalSaleValue.toLocaleString('en-IN')}`],
      [],
      ['INCOME BREAKDOWN'],
      [`Calculated Sales: ₹${reportData.incomeBreakdown.calculatedSaleValue.toLocaleString('en-IN')}`],
      [`Cash Received: ₹${reportData.incomeBreakdown.cashReceived.toLocaleString('en-IN')}`],
      [`Online Received: ₹${reportData.incomeBreakdown.onlineReceived.toLocaleString('en-IN')}`],
      [`Credit Pending: ₹${reportData.incomeBreakdown.creditPending.toLocaleString('en-IN')}`],
      [],
      ['INCOME STATEMENT'],
      [`Total Sales: ₹${reportData.incomeStatement.totalSalesGenerated.toLocaleString('en-IN')}`],
      [`Less Credit Pending: -₹${reportData.incomeStatement.lessCreditPending.toLocaleString('en-IN')}`],
      [`Net Cash Income: ₹${reportData.incomeStatement.netCashIncome.toLocaleString('en-IN')}`]
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `income-report-${dateRange.startDate}.csv`;
    a.click();

    toast({
      title: 'Success',
      description: 'Report exported to CSV',
      variant: 'success'
    });
  };

  if (!selectedStation) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please select a station from the sidebar
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-12 text-center">
            <p className="text-muted-foreground">Loading report...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              Error loading report data
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const incomeData = reportData.incomeBreakdown;
  // Map fuelType null or 'null' to 'Unknown' for display
  const fuelData = reportData.summaryMetrics.fuelBreakdown.map(fb => ({
    ...fb,
    fuelType: (!fb.fuelType || fb.fuelType === 'null' || fb.fuelType === null) ? 'Unknown' : fb.fuelType
  }));
  const receivablesData = reportData.receivables.aging;
  const settlementData = reportData.settlements;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold">Income & Receivables Report</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Comprehensive view of sales, cash, receivables, and settlements
        </p>
      </div>

      {/* Controls */}
      <Card className="bg-slate-50">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">View Type</Label>
              <Select value={viewType} onValueChange={(v: any) => handleViewTypeChange(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Start Date</Label>
              <Input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">End Date</Label>
              <Input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              />
            </div>

            <div className="flex items-end space-y-2">
              <Button onClick={handleExportCSV} variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Droplet className="w-4 h-4 text-blue-600" />
              Total Liters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">
              {safeToFixed(reportData.summaryMetrics.totalLiters, 0)} L
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {reportData.summaryMetrics.fuelBreakdown.length} fuel types
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Sale Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">
              ₹{reportData.summaryMetrics.totalSaleValue && reportData.summaryMetrics.totalSaleValue > 0
                ? reportData.summaryMetrics.totalSaleValue.toLocaleString('en-IN')
                : reportData.incomeBreakdown.calculatedSaleValue.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Calculated from readings
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-orange-600" />
              Variance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl md:text-2xl font-bold ${reportData.settlementSummary.totalVariance < 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{reportData.settlementSummary.totalVariance.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg: {safeToFixed(reportData.settlementSummary.avgVariancePercent, 2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Income Breakdown & Pie Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        {/* Income Details */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Income Breakdown</CardTitle>
            <CardDescription>Cash, Online, and Credit received</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm font-medium">Calculated Sale Value</span>
                <span className="font-bold text-sm md:text-base">₹{incomeData.calculatedSaleValue.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b bg-green-50 px-2 py-1 rounded">
                <span className="text-sm">Cash Received</span>
                <span className="font-semibold text-green-700 text-sm md:text-base">
                  ₹{incomeData.cashReceived.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b bg-blue-50 px-2 py-1 rounded">
                <span className="text-sm">Online Received</span>
                <span className="font-semibold text-blue-700 text-sm md:text-base">
                  ₹{incomeData.onlineReceived.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b bg-yellow-50 px-2 py-1 rounded">
                <span className="text-sm">Credit Pending</span>
                <span className="font-semibold text-yellow-700 text-sm md:text-base">
                  ₹{incomeData.creditPending.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 bg-slate-100 px-2 py-2 rounded font-bold">
                <span className="text-sm md:text-base">Verification</span>
                <span className={`text-sm md:text-base ${incomeData.verification.match ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{incomeData.verification.total.toLocaleString('en-IN')} {incomeData.verification.match ? '✓' : '✗'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Income Pie Chart */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Income Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Cash', value: incomeData.cashReceived },
                    { name: 'Online', value: incomeData.onlineReceived },
                    { name: 'Credit', value: incomeData.creditPending }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#22c55e" />
                  <Cell fill="#3b82f6" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Tooltip formatter={(value: any) => `₹${value.toLocaleString('en-IN')}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Fuel Type Breakdown */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg">Fuel Type Breakdown</CardTitle>
          <CardDescription>Liters and revenue by fuel type</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={fuelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="fuelType" 
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis yAxisId="left" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" fontSize={12} />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  name === 'Liters' ? `${value} L` : `₹${value.toLocaleString('en-IN')}`,
                  name
                ]}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="liters" fill="#3b82f6" name="Liters" radius={[2, 2, 0, 0]} />
              <Bar yAxisId="right" dataKey="value" fill="#10b981" name="Value (₹)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Settlements with Variance */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg">Daily Settlements</CardTitle>
          <CardDescription>Cash reconciliation and variance tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 md:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 md:px-4 font-medium">Date</th>
                    <th className="text-right py-3 px-2 md:px-4 font-medium hidden sm:table-cell">Expected</th>
                    <th className="text-right py-3 px-2 md:px-4 font-medium">Actual</th>
                    <th className="text-right py-3 px-2 md:px-4 font-medium">Variance</th>
                    <th className="text-center py-3 px-2 md:px-4 font-medium hidden md:table-cell">Status</th>
                    <th className="text-left py-3 px-2 md:px-4 font-medium hidden lg:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {settlementData.map((s) => (
                    <tr key={s.date} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-2 md:px-4 font-medium">{s.date}</td>
                      <td className="text-right py-3 px-2 md:px-4 text-muted-foreground hidden sm:table-cell">
                        ₹{s.expectedCash.toLocaleString('en-IN')}
                      </td>
                      <td className="text-right py-3 px-2 md:px-4">
                        ₹{s.actualCash.toLocaleString('en-IN')}
                      </td>
                      <td className={`text-right py-3 px-2 md:px-4 font-semibold ${s.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-1">
                          <span>₹{s.variance.toLocaleString('en-IN')}</span>
                          <span className="text-xs text-muted-foreground">({s.variancePercent.toFixed(2)}%)</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2 md:px-4 hidden md:table-cell">
                        <Badge className={`${getVarianceStatusColor(s.varianceStatus)} text-xs`}>
                          {s.varianceStatus}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 md:px-4 text-xs text-muted-foreground hidden lg:table-cell max-w-xs truncate">
                        {s.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Mobile summary for hidden columns */}
          <div className="mt-4 space-y-2 md:hidden">
            {settlementData.slice(0, 3).map((s) => (
              <div key={s.date} className="bg-slate-50 p-3 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{s.date}</span>
                  <Badge className={`${getVarianceStatusColor(s.varianceStatus)} text-xs`}>
                    {s.varianceStatus}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Expected:</span>
                    <div className="font-medium">₹{s.expectedCash.toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actual:</span>
                    <div className="font-medium">₹{s.actualCash.toLocaleString('en-IN')}</div>
                  </div>
                </div>
                {s.notes && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Notes:</span> {s.notes}
                  </div>
                )}
              </div>
            ))}
            {settlementData.length > 3 && (
              <div className="text-center text-sm text-muted-foreground">
                And {settlementData.length - 3} more settlements...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Receivables Aging */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg">Credit Receivables Aging</CardTitle>
          <CardDescription className="text-sm md:text-base">
            Total Outstanding: ₹{reportData.receivables.summary.totalOutstanding.toLocaleString('en-IN')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Aging Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 hover:shadow-sm transition-shadow">
              <p className="text-sm text-muted-foreground mb-2">Current (0-30 days)</p>
              <p className="text-xl md:text-2xl font-bold text-green-700">
                ₹{reportData.receivables.summary.current.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 hover:shadow-sm transition-shadow">
              <p className="text-sm text-muted-foreground mb-2">Overdue (31-60 days)</p>
              <p className="text-xl md:text-2xl font-bold text-orange-700">₹0</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 hover:shadow-sm transition-shadow">
              <p className="text-sm text-muted-foreground mb-2">Very Overdue (&gt;60 days)</p>
              <p className="text-xl md:text-2xl font-bold text-red-700">
                ₹{Math.max(0, reportData.receivables.summary.overdue).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Receivables Table */}
          <div className="overflow-x-auto -mx-2 md:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 md:px-4 font-medium">Creditor</th>
                    <th className="text-right py-3 px-2 md:px-4 font-medium">Balance</th>
                    <th className="text-center py-3 px-2 md:px-4 font-medium hidden sm:table-cell">Due Date</th>
                    <th className="text-center py-3 px-2 md:px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {receivablesData.map((r) => (
                    <tr key={r.creditorId} className={`border-b hover:bg-slate-50 transition-colors ${getAgingColor(r.agingBucket)}`}>
                      <td className="py-3 px-2 md:px-4 font-medium">{r.creditorName}</td>
                      <td className="text-right py-3 px-2 md:px-4 font-semibold">
                        ₹{r.balance.toLocaleString('en-IN')}
                      </td>
                      <td className="text-center py-3 px-2 md:px-4 hidden sm:table-cell text-muted-foreground">
                        {r.dueDate}
                      </td>
                      <td className="text-center py-3 px-2 md:px-4">
                        <Badge variant={r.agingBucket === 'Current' ? 'outline' : 'destructive'} className="text-xs">
                          {r.agingBucket}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card view for receivables */}
          <div className="space-y-3 md:hidden">
            {receivablesData.slice(0, 5).map((r) => (
              <div key={r.creditorId} className={`p-4 rounded-lg border ${getAgingColor(r.agingBucket)} hover:shadow-sm transition-shadow`}>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold">{r.creditorName}</h4>
                  <Badge variant={r.agingBucket === 'Current' ? 'outline' : 'destructive'} className="text-xs">
                    {r.agingBucket}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Balance:</span>
                    <span className="font-semibold">₹{r.balance.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date:</span>
                    <span>{r.dueDate}</span>
                  </div>
                </div>
              </div>
            ))}
            {receivablesData.length > 5 && (
              <div className="text-center text-sm text-muted-foreground">
                And {receivablesData.length - 5} more receivables...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Creditor Settlements */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg">Creditor Settlements</CardTitle>
          <CardDescription>Payments received from credit sales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(reportData.creditorSettlements).map(([creditorName, data]) => (
              <div key={creditorName} className="border rounded-lg p-4 space-y-3 hover:shadow-sm transition-shadow bg-gradient-to-br from-slate-50/50 to-white">
                <h4 className="font-semibold text-base text-slate-800">{creditorName}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Total Credited</span>
                    <span className="font-medium text-slate-700">₹{data.totalCredited.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Total Settled</span>
                    <span className="font-medium text-green-600">₹{data.totalSettled.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="font-medium text-slate-800">Outstanding</span>
                    <span className={`font-bold ${data.outstanding > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      ₹{data.outstanding.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {Object.keys(reportData.creditorSettlements).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No creditor settlements found for the selected period.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Income Statement */}
      <Card className="border-2 border-slate-300 hover:shadow-lg transition-shadow bg-gradient-to-br from-slate-50/30 to-white">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Income Statement Summary</CardTitle>
          <CardDescription className="text-sm md:text-base">Net cash income calculation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:space-y-4">
            <div className="flex justify-between items-center text-sm md:text-base py-2 border-b border-slate-200">
              <span className="font-medium">Total Sales Generated</span>
              <span className="font-bold text-slate-800">₹{reportData.incomeStatement.totalSalesGenerated.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center text-sm md:text-base py-2 border-b border-red-200 text-red-600">
              <span className="font-medium">Less: Credit Pending</span>
              <span className="font-bold">-₹{Math.abs(reportData.incomeStatement.lessCreditPending).toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center text-sm md:text-base py-2 border-b border-orange-200 text-orange-600">
              <span className="font-medium">Less: Settlement Variance</span>
              <span className="font-bold">-₹{Math.abs(reportData.incomeStatement.lessCashVariance).toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center text-base md:text-lg py-3 bg-gradient-to-r from-green-50 to-green-100 px-3 md:px-4 rounded-lg font-bold border border-green-200">
              <span className="text-green-800">NET CASH INCOME</span>
              <span className="text-green-700">₹{reportData.incomeStatement.netCashIncome.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
