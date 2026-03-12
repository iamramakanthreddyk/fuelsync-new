
/**
 * Income Report - Simplified
 * Clean overview of key financial metrics
 */

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useStations, useExpenses } from '@/hooks/api';
import { analyticsApi, parseSalesAmount } from '@/api/analytics';
import { safeToFixed } from '@/lib/format-utils';
import {
  TrendingUp, IndianRupee, Download, TrendingDown
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';



export default function IncomeReport() {
  const { toast } = useToast();
  const { data: stationsResponse } = useStations();
  const stations = useMemo(() => {
    if (stationsResponse && 'data' in stationsResponse) {
      return stationsResponse.data || [];
    }
    return [];
  }, [stationsResponse]);

  // Ensure selectedStation is always valid when stations list changes
  const [selectedStation, setSelectedStation] = useState<string>('');
  useEffect(() => {
    if (stations.length > 0 && !selectedStation) {
      setSelectedStation(stations[0].id);
    }
  }, [stations, selectedStation]);

  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [viewType, setViewType] = useState<'daily' | 'monthly' | 'yearly'>('monthly');

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
  const { data: rawReportData, isLoading, error } = useQuery({
    queryKey: ['income-report', selectedStation, dateRange],
    queryFn: async () => {
      if (!selectedStation) return null;
      const response = await analyticsApi.getIncomeReceivables(
        selectedStation,
        dateRange.startDate,
        dateRange.endDate
      );
      return response?.data;
    },
    enabled: !!selectedStation
  });

  // Transform backend response to expected format
  const reportData = useMemo(() => {
    if (!rawReportData) return null;
    
    const data = rawReportData as any;
    
    return {
      period: data.period || { startDate: dateRange.startDate, endDate: dateRange.endDate },
      salesBreakdown: {
        totalSales: data.incomeBreakdown?.calculatedSaleValue || 0,
        totalLitres: data.summaryMetrics?.totalLiters || 0,
        transactions: 0,
        cash: data.incomeBreakdown?.cashReceived || 0,
        online: data.incomeBreakdown?.onlineReceived || 0,
        credit: data.incomeBreakdown?.creditPending || 0
      },
      creditorsBreakdown: {
        totalOutstanding: data.receivables?.summary?.totalOutstanding || 0,
        totalOverdue: data.receivables?.summary?.overdue || 0,
        creditors: []
      }
    };
  }, [rawReportData, dateRange]);

  // Fetch expenses for the date range
  const { data: expensesResponse } = useExpenses(selectedStation || '', {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  });

  const expenses = useMemo(() => {
    if (expensesResponse && 'data' in expensesResponse) {
      return (expensesResponse as any).data?.data || [];
    }
    return [];
  }, [expensesResponse]);

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum: number, exp: any) => sum + parseSalesAmount(exp.amount), 0);
  }, [expenses]);

  const expensesByCategory = useMemo(() => {
    const categories: Record<string, number> = {};
    expenses.forEach((exp: any) => {
      if (exp.category) {
        categories[exp.category] = (categories[exp.category] || 0) + (exp.amount || 0);
      }
    });
    return Object.entries(categories).map(([category, amount]) => ({ category, amount }));
  }, [expenses]);

  const handleExportCSV = () => {
    if (!reportData) return;

    const csv = [
      ['INCOME REPORT'],
      [`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`],
      [],
      ['Total Sales', reportData.salesBreakdown.totalSales],
      ['Cash Received', reportData.salesBreakdown.cash],
      ['Online Received', reportData.salesBreakdown.online],
      ['Credit Pending', reportData.salesBreakdown.credit],
      ['Outstanding Receivables', reportData.creditorsBreakdown.totalOutstanding],
      ['Net Cash Income', reportData.salesBreakdown.totalSales - totalExpenses]
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

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header with Station Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Income Report</h1>
          <p className="text-muted-foreground">
            {new Date(reportData.period.startDate).toLocaleDateString('en-IN')} - {new Date(reportData.period.endDate).toLocaleDateString('en-IN')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          {/* Station Selector Dropdown */}
          {stations.length > 1 && (
            <Select value={selectedStation} onValueChange={setSelectedStation}>
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder="Select Station" />
              </SelectTrigger>
              <SelectContent>
                {stations.map((station) => (
                  <SelectItem key={station.id} value={station.id}>
                    {station.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleExportCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Period</Label>
              <Select value={viewType} onValueChange={(v) => handleViewTypeChange(v as 'daily' | 'monthly' | 'yearly')}>
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

            <DateRangeFilter
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onDateRangeChange={(start, end) =>
                setDateRange({ startDate: start, endDate: end })
              }
              dataType="analytics"
            />
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Total Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ₹{reportData.salesBreakdown.totalSales.toLocaleString('en-IN')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-blue-600" />
              Cash Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ₹{reportData.salesBreakdown.cash.toLocaleString('en-IN')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ₹{totalExpenses.toLocaleString('en-IN')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-orange-600" />
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ₹{reportData.creditorsBreakdown.totalOutstanding.toLocaleString('en-IN')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              ₹{(reportData.salesBreakdown.totalSales - totalExpenses).toLocaleString('en-IN')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Breakdown</CardTitle>
          <CardDescription>How customers paid for fuel</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-1">
                ₹{reportData.salesBreakdown.cash.toLocaleString('en-IN')}
              </div>
              <div className="text-sm text-muted-foreground">Cash</div>
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                ₹{reportData.salesBreakdown.online.toLocaleString('en-IN')}
              </div>
              <div className="text-sm text-muted-foreground">Online</div>
            </div>

            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                ₹{reportData.salesBreakdown.credit.toLocaleString('en-IN')}
              </div>
              <div className="text-sm text-muted-foreground">Credit</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Breakdown */}
      {expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
            <CardDescription>{expenses.length} expenses recorded</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {expensesByCategory.slice(0, 6).map((item) => (
                <div key={item.category} className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-xl font-bold text-red-600 mb-1">
                    ₹{item.amount.toLocaleString('en-IN')}
                  </div>
                  <div className="text-sm text-muted-foreground capitalize">{item.category}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Period Summary</h3>
            <p className="text-muted-foreground mb-4">
              {safeToFixed(reportData.salesBreakdown.totalLitres, 0)} liters sold •
              ₹{reportData.salesBreakdown.totalSales.toLocaleString('en-IN')} total sales
            </p>
            <div className="text-sm text-muted-foreground">
              Report generated on {new Date().toLocaleDateString('en-IN')}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
