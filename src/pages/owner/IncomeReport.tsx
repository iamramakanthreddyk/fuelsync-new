/**
 * Income Report - Simplified
 * Clean overview of key financial metrics
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { safeToFixed } from '@/lib/format-utils';
import { useStations } from '@/hooks/api';
import {
  TrendingUp, IndianRupee, AlertTriangle, Download,
  Calendar, CreditCard, DollarSign
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
  };
  incomeBreakdown: {
    calculatedSaleValue: number;
    cashReceived: number;
    onlineReceived: number;
    creditPending: number;
  };
  receivables: {
    summary: { totalOutstanding: number };
  };
  incomeStatement: {
    netCashIncome: number;
  };
}

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
      ['INCOME REPORT'],
      [`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`],
      [],
      ['Total Sales', reportData.incomeBreakdown.calculatedSaleValue],
      ['Cash Received', reportData.incomeBreakdown.cashReceived],
      ['Online Received', reportData.incomeBreakdown.onlineReceived],
      ['Credit Pending', reportData.incomeBreakdown.creditPending],
      ['Outstanding Receivables', reportData.receivables.summary.totalOutstanding],
      ['Net Cash Income', reportData.incomeStatement.netCashIncome]
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Income Report</h1>
          <p className="text-muted-foreground">
            {new Date(reportData.period.startDate).toLocaleDateString('en-IN')} - {new Date(reportData.period.endDate).toLocaleDateString('en-IN')}
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Period</Label>
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
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Total Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ₹{reportData.incomeBreakdown.calculatedSaleValue.toLocaleString('en-IN')}
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
              ₹{reportData.incomeBreakdown.cashReceived.toLocaleString('en-IN')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-orange-600" />
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ₹{reportData.receivables.summary.totalOutstanding.toLocaleString('en-IN')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              Net Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              ₹{reportData.incomeStatement.netCashIncome.toLocaleString('en-IN')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Breakdown</CardTitle>
          <CardDescription>How customers paid for fuel</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-1">
                ₹{reportData.incomeBreakdown.cashReceived.toLocaleString('en-IN')}
              </div>
              <div className="text-sm text-muted-foreground">Cash</div>
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                ₹{reportData.incomeBreakdown.onlineReceived.toLocaleString('en-IN')}
              </div>
              <div className="text-sm text-muted-foreground">Online</div>
            </div>

            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                ₹{reportData.incomeBreakdown.creditPending.toLocaleString('en-IN')}
              </div>
              <div className="text-sm text-muted-foreground">Credit</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Period Summary</h3>
            <p className="text-muted-foreground mb-4">
              {safeToFixed(reportData.summaryMetrics.totalLiters, 0)} liters sold •
              ₹{reportData.incomeBreakdown.calculatedSaleValue.toLocaleString('en-IN')} total sales
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
