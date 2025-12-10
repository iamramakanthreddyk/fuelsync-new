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
  const fuelData = reportData.summaryMetrics.fuelBreakdown;
  const receivablesData = reportData.receivables.aging;
  const settlementData = reportData.settlements;

  return (
    <div className="container mx-auto p-6 space-y-6 pt-6 sm:pt-3 md:pt-0">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Income & Receivables Report</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive view of sales, cash, receivables, and settlements
        </p>
      </div>

      {/* Controls */}
      <Card className="bg-slate-50">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
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

            <div>
              <Label className="text-sm font-medium">Start Date</Label>
              <Input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-sm font-medium">End Date</Label>
              <Input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleExportCSV} variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Droplet className="w-4 h-4 text-blue-600" />
              Total Liters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeToFixed(reportData.summaryMetrics.totalLiters, 0)} L
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {reportData.summaryMetrics.fuelBreakdown.length} fuel types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Sale Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(reportData.summaryMetrics.totalSaleValue / 100000).toFixed(1)}L
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Calculated from readings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-orange-600" />
              Variance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${reportData.settlementSummary.totalVariance < 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{reportData.settlementSummary.totalVariance.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg: {safeToFixed(reportData.settlementSummary.avgVariancePercent, 2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Income Breakdown & Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Details */}
        <Card>
          <CardHeader>
            <CardTitle>Income Breakdown</CardTitle>
            <CardDescription>Cash, Online, and Credit received</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm font-medium">Calculated Sale Value</span>
                <span className="font-bold">₹{incomeData.calculatedSaleValue.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b bg-green-50 px-2 py-1 rounded">
                <span className="text-sm">Cash Received</span>
                <span className="font-semibold text-green-700">
                  ₹{incomeData.cashReceived.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b bg-blue-50 px-2 py-1 rounded">
                <span className="text-sm">Online Received</span>
                <span className="font-semibold text-blue-700">
                  ₹{incomeData.onlineReceived.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b bg-yellow-50 px-2 py-1 rounded">
                <span className="text-sm">Credit Pending</span>
                <span className="font-semibold text-yellow-700">
                  ₹{incomeData.creditPending.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 bg-slate-100 px-2 py-2 rounded font-bold">
                <span>Verification</span>
                <span className={incomeData.verification.match ? 'text-green-600' : 'text-red-600'}>
                  ₹{incomeData.verification.total.toLocaleString('en-IN')} {incomeData.verification.match ? '✓' : '✗'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Income Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Income Distribution</CardTitle>
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
      <Card>
        <CardHeader>
          <CardTitle>Fuel Type Breakdown</CardTitle>
          <CardDescription>Liters and revenue by fuel type</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={fuelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fuelType" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="liters" fill="#3b82f6" name="Liters" />
              <Bar yAxisId="right" dataKey="value" fill="#10b981" name="Value (₹)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Settlements with Variance */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Settlements</CardTitle>
          <CardDescription>Cash reconciliation and variance tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-right py-2 px-2">Expected</th>
                  <th className="text-right py-2 px-2">Actual</th>
                  <th className="text-right py-2 px-2">Variance</th>
                  <th className="text-center py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {settlementData.map((s) => (
                  <tr key={s.date} className="border-b hover:bg-slate-50">
                    <td className="py-2 px-2">{s.date}</td>
                    <td className="text-right py-2 px-2">₹{s.expectedCash.toLocaleString('en-IN')}</td>
                    <td className="text-right py-2 px-2">₹{s.actualCash.toLocaleString('en-IN')}</td>
                    <td className={`text-right py-2 px-2 font-semibold ${s.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₹{s.variance.toLocaleString('en-IN')} ({s.variancePercent.toFixed(2)}%)
                    </td>
                    <td className="text-center py-2 px-2">
                      <Badge className={getVarianceStatusColor(s.varianceStatus)}>
                        {s.varianceStatus}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">{s.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Receivables Aging */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Receivables Aging</CardTitle>
          <CardDescription>
            Total Outstanding: ₹{reportData.receivables.summary.totalOutstanding.toLocaleString('en-IN')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded border border-green-200">
              <p className="text-sm text-muted-foreground">Current (0-30 days)</p>
              <p className="text-2xl font-bold text-green-700">
                ₹{reportData.receivables.summary.current.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded border border-orange-200">
              <p className="text-sm text-muted-foreground">Overdue (31-60 days)</p>
              <p className="text-2xl font-bold text-orange-700">₹0</p>
            </div>
            <div className="bg-red-50 p-4 rounded border border-red-200">
              <p className="text-sm text-muted-foreground">Very Overdue (&gt;60 days)</p>
              <p className="text-2xl font-bold text-red-700">
                ₹{Math.max(0, reportData.receivables.summary.overdue).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Creditor</th>
                  <th className="text-right py-2 px-2">Balance</th>
                  <th className="text-center py-2 px-2">Due Date</th>
                  <th className="text-center py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {receivablesData.map((r) => (
                  <tr key={r.creditorId} className={`border-b ${getAgingColor(r.agingBucket)}`}>
                    <td className="py-2 px-2 font-medium">{r.creditorName}</td>
                    <td className="text-right py-2 px-2">₹{r.balance.toLocaleString('en-IN')}</td>
                    <td className="text-center py-2 px-2">{r.dueDate}</td>
                    <td className="text-center py-2 px-2">
                      <Badge variant={r.agingBucket === 'Current' ? 'outline' : 'destructive'}>
                        {r.agingBucket}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Creditor Settlements */}
      <Card>
        <CardHeader>
          <CardTitle>Creditor Settlements</CardTitle>
          <CardDescription>Payments received from credit sales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(reportData.creditorSettlements).map(([creditorName, data]) => (
              <div key={creditorName} className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold">{creditorName}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Credited</span>
                    <span className="font-medium">₹{data.totalCredited.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Settled</span>
                    <span className="font-medium text-green-600">₹{data.totalSettled.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">Outstanding</span>
                    <span className={`font-bold ${data.outstanding > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      ₹{data.outstanding.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Income Statement */}
      <Card className="border-2 border-slate-300">
        <CardHeader>
          <CardTitle className="text-lg">Income Statement Summary</CardTitle>
          <CardDescription>Net cash income calculation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-base py-2 border-b">
              <span>Total Sales Generated</span>
              <span className="font-bold">₹{reportData.incomeStatement.totalSalesGenerated.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-base py-2 border-b text-red-600">
              <span>Less: Credit Pending</span>
              <span className="font-bold">-₹{Math.abs(reportData.incomeStatement.lessCreditPending).toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-base py-2 border-b text-orange-600">
              <span>Less: Settlement Variance</span>
              <span className="font-bold">-₹{Math.abs(reportData.incomeStatement.lessCashVariance).toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-lg py-3 bg-slate-100 px-2 rounded font-bold">
              <span>NET CASH INCOME</span>
              <span className="text-green-700">₹{reportData.incomeStatement.netCashIncome.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
