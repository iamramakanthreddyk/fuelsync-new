/**
 * Daily Sales Report Page
 * Comprehensive daily financial summary: Sales, Expenses, Shortfalls & Profit/Loss
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { getExpenseSummary, type ExpenseSummary } from '@/lib/expenses-api';
import { safeToFixed, formatVolume } from '@/lib/format-utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { ArrowLeft, Printer, TrendingUp, TrendingDown, AlertCircle, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useSettlements } from '@/hooks/useReportData';
import { calculateCOGS, calculateProfit, calculateProfitMargin } from '@/lib/profit-utils';
// aggregation is done inline from API rows below

interface FuelTypeData {
  value: number;
  liters: number;
  count: number;
}

interface DailySalesReportData {
  date: string;
  stationId: string;
  stationName: string;
  totalSaleValue: number;
  totalLiters: number;
  readingsCount: number;
  byFuelType: Record<string, FuelTypeData>;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];


export default function DailySalesReport() {
  const navigate = useNavigate();
  const { canAccessFeature } = usePermissions();
  const selectedDate = new Date().toISOString().split('T')[0];
  const [selectedStationId, setSelectedStationId] = useState<string>('');

  // Fetch raw sales readings
  const { data: apiResponse, isLoading: salesLoading } = useQuery({
    queryKey: ['sales-report', selectedDate],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: any[] }>(`/analytics/sales?startDate=${selectedDate}&endDate=${selectedDate}`);
      const payload = (response as any)?.data ?? response;
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
      return rows;
    }
  });

  // Fetch expenses for the day
  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['daily-expenses', selectedDate, selectedStationId],
    queryFn: async () => {
      if (!selectedStationId) return null;
      const response = await getExpenseSummary(selectedStationId, selectedDate, selectedDate);
      return response?.data ?? response;
    },
    enabled: !!selectedStationId
  });

  // Fetch settlements for shortfall/variance data
  const { data: settlementsData = [], isLoading: shortfallLoading } = useSettlements({
    dateRange: { startDate: selectedDate, endDate: selectedDate },
    selectedStation: selectedStationId
  });

  // Helper to extract rows array from various API shapes
  const tryExtractRows = (obj: any): any[] | undefined => {
    if (!obj) return undefined;
    if (Array.isArray(obj)) return obj;
    if (obj.data && Array.isArray(obj.data)) return obj.data;
    if (obj.data && obj.data.data && Array.isArray(obj.data.data)) return obj.data.data;
    if (obj.rows && Array.isArray(obj.rows)) return obj.rows;
    return undefined;
  };

  const extractedRows = tryExtractRows(apiResponse) ?? [];

  // Normalize response into an array of DailySalesReportData regardless of API shape
  const normalizedReports: DailySalesReportData[] = (() => {
    const rows = extractedRows;
    if (!rows || rows.length === 0) return [];

    if ((rows[0] as any).byFuelType) return rows as DailySalesReportData[];

    if ((rows[0] as any).stationId) {
      const map: Record<string, DailySalesReportData> = {};
      rows.forEach((r: any) => {
        const key = `${r.stationId}::${r.readingDate}`;
        if (!map[key]) {
          map[key] = {
            date: r.readingDate,
            stationId: r.stationId,
            stationName: r.stationName,
            totalSaleValue: 0,
            totalLiters: 0,
            readingsCount: 0,
            byFuelType: {}
          };
        }
        const entry = map[key];
        const volume = Number(r.deltaVolumeL) || 0;
        const amount = Number(r.totalAmount) || 0;
        entry.totalLiters += volume;
        entry.totalSaleValue += amount;
        entry.readingsCount += 1;
        const fuel = r.fuelType || 'unknown';
        if (!entry.byFuelType[fuel]) entry.byFuelType[fuel] = { value: 0, liters: 0, count: 0 };
        entry.byFuelType[fuel].value += amount;
        entry.byFuelType[fuel].liters += volume;
        entry.byFuelType[fuel].count += 1;
      });
      return Object.values(map);
    }

    return [];
  })();

  const isValidData = normalizedReports.length > 0;

  // When response data arrives, set a default station if none selected
  useEffect(() => {
    if (isValidData && !selectedStationId && normalizedReports.length > 0) {
      setSelectedStationId(normalizedReports[0].stationId || '');
    }
  }, [isValidData, normalizedReports, selectedStationId]);
  // Build station options from normalized reports
  const stationOptions = normalizedReports.map(r => ({ id: String(r.stationId), name: r.stationName }));

  const report = isValidData
    ? normalizedReports.find(r => String(r.stationId) === String(selectedStationId)) || normalizedReports[0]
    : undefined;

  // Extract expenses data from summary
  const expensesSummary: ExpenseSummary = expensesData || {
    mode: 'monthly',
    approvedTotal: 0,
    pendingCount: 0,
    pendingAmount: 0,
    byCategory: [],
    byFrequency: [],
  };
  
  const totalExpenses = (expensesSummary.approvedTotal || 0) + (expensesSummary.pendingAmount || 0);
  const expensesByCategory: Record<string, number> = {};
  
  // Use byCategory from summary if available
  if (expensesSummary.byCategory && Array.isArray(expensesSummary.byCategory)) {
    expensesSummary.byCategory.forEach((cat: any) => {
      expensesByCategory[cat.category] = cat.total || 0;
    });
  }
  
  // For display purposes, create a dailyExpenses array for UI rendering
  const dailyExpenses = expensesSummary.byCategory?.map((cat: any, idx: number) => ({
    id: `${cat.category}-${idx}`,
    category: cat.category,
    amount: cat.total || 0,
  })) || [];

  // Extract shortfall data
  const shortfalls = settlementsData || [];
  const totalShortfall = shortfalls.reduce((sum: number, s: any) => sum + Math.max(0, s.variance || 0), 0);

  // Calculate financial summary
  const avgTransaction = report?.readingsCount ? report.totalSaleValue / report.readingsCount : 0;
  
  // Calculate COGS and Profit using utility functions
  // If cost price not defined, assumes 2% profit margin (98% COGS)
  const cogs = report ? calculateCOGS(report.totalSaleValue) : 0;
  const profit = report ? calculateProfit(report.totalSaleValue, totalExpenses, totalShortfall) : 0;
  const profitMargin = report ? calculateProfitMargin(report.totalSaleValue, profit) : 0;

  // Convert byFuelType object to array for charts
  const fuelTypeArray = report && report.byFuelType
    ? Object.entries(report.byFuelType).map(([name, data]) => {
        const total = report.totalSaleValue;
        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          liters: data.liters,
          value: data.value,
          count: data.count,
          percentage: total > 0 ? (data.value / total) * 100 : 0
        };
      })
    : [];

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!report) return;
    const rows: string[] = [];

    const esc = (val: any) => {
      const str = String(val ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };
    const line = (...cols: any[]) => rows.push(cols.map(esc).join(','));
    const blank = () => rows.push('');
    const section = (title: string) => { blank(); line(title); };

    // Header
    line('DAILY FINANCIAL REPORT');
    line('Station', report.stationName);
    line('Date', new Date(report.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    line('Generated', new Date().toLocaleString('en-IN'));

    // Financial Summary
    section('--- FINANCIAL SUMMARY ---');
    line('Revenue (Rs)', 'Fuel Dispensed (L)', 'Transactions', 'Avg Transaction (Rs)', 'Expenses (Rs)', 'Shortfall (Rs)', 'Net Profit (Rs)', 'Profit Margin (%)');
    line(
      safeToFixed(report.totalSaleValue, 2),
      safeToFixed(report.totalLiters, 2),
      report.readingsCount,
      safeToFixed(avgTransaction, 2),
      safeToFixed(totalExpenses, 2),
      safeToFixed(totalShortfall, 2),
      safeToFixed(profit, 2),
      safeToFixed(profitMargin, 1)
    );

    // P&L Statement
    section('--- PROFIT & LOSS STATEMENT ---');
    line('Item', 'Amount (Rs)');
    line('Revenue', safeToFixed(report.totalSaleValue, 2));
    line('Less: COGS (Cost of Goods Sold)', safeToFixed(-cogs, 2));
    line('Less: Shortfall/Variance', safeToFixed(-totalShortfall, 2));
    line('Less: Expenses', safeToFixed(-totalExpenses, 2));
    line('Net Profit / Loss', safeToFixed(profit, 2));
    line('Profit Margin (%)', safeToFixed(profitMargin, 1));

    // Sales by Fuel Type
    if (fuelTypeArray.length > 0) {
      section('--- SALES BY FUEL TYPE ---');
      line('Fuel Type', 'Liters', 'Revenue (Rs)', 'Transactions', 'Percentage (%)');
      fuelTypeArray.forEach(f => {
        line(f.name, safeToFixed(f.liters, 2), safeToFixed(f.value, 2), f.count, safeToFixed(f.percentage, 1));
      });
    }

    // Expenses
    if (dailyExpenses.length > 0) {
      section('--- EXPENSES ---');
      line('Category', 'Amount (Rs)');
      dailyExpenses.forEach((exp: any) => {
        line(exp.category || 'Other', safeToFixed(exp.amount || 0, 2));
      });
      line('TOTAL EXPENSES', safeToFixed(totalExpenses, 2));
    }

    // Shortfalls
    if (shortfalls.length > 0) {
      section('--- SHORTFALLS & VARIANCE ---');
      line('Settlement Type', 'Date', 'Variance (Rs)');
      shortfalls.forEach((s: any) => {
        line(
          s.settlementType || 'Settlement',
          s.settlementDate ? new Date(s.settlementDate).toLocaleDateString('en-IN') : '',
          safeToFixed(s.variance || 0, 2)
        );
      });
      line('TOTAL SHORTFALL', safeToFixed(totalShortfall, 2));
    }

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily-report-${report.stationName.replace(/\s+/g, '-')}-${report.date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = salesLoading || expensesLoading || shortfallLoading;

  if (isLoading || !isValidData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          {isLoading ? 'Loading daily report...' : 'No data available for this date'}
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No data available for this date</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }


  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl print:p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 print:mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="print:hidden border border-gray-200 hover:border-gray-400"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold">Daily Financial Report</h1>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              title="Export all data as CSV"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            {canAccessFeature('pdf_export') && (
              <Button
                onClick={handleExportPDF}
                variant="outline"
                size="icon"
                title="Print report"
              >
                <Printer className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0">
          <select
            className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 min-w-[170px]"
            value={selectedStationId}
            onChange={e => setSelectedStationId(e.target.value)}
          >
            {stationOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-primary">{report.stationName}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground text-sm">
              {new Date(report.date).toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Summary Cards - Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Revenue</div>
            <div className="text-2xl font-bold text-green-600">₹{safeToFixed(report.totalSaleValue, 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">{report.readingsCount} transactions</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Fuel Dispensed</div>
            <div className="text-2xl font-bold text-blue-600">{formatVolume(report.totalLiters)}</div>
            <div className="text-xs text-muted-foreground mt-1">Avg: ₹{safeToFixed(avgTransaction, 0)}/txn</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Expenses</div>
            <div className="text-2xl font-bold text-orange-600">₹{safeToFixed(totalExpenses, 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">{dailyExpenses.length} items</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Shortfall
            </div>
            <div className={`text-2xl font-bold ${totalShortfall > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{safeToFixed(Math.abs(totalShortfall), 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{shortfalls.length} settlements</div>
          </CardContent>
        </Card>

        <Card className={`border-2 ${profit >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1 font-semibold">Net Profit</div>
            <div className={`text-2xl font-bold flex items-center gap-1 ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {profit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              ₹{safeToFixed(Math.abs(profit), 0)}
            </div>
            <div className={`text-xs mt-1 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{safeToFixed(profitMargin, 1)}% margin</div>
          </CardContent>
        </Card>
      </div>

      {/* P&L Statement */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Profit & Loss Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between pb-2 border-b font-semibold">
              <span>Revenue</span>
              <span className="text-green-600">₹{safeToFixed(report.totalSaleValue, 0)}</span>
            </div>
            <div className="flex justify-between pb-2 border-b text-yellow-600">
              <span>Less: COGS (Cost of Goods Sold)</span>
              <span className="font-semibold">- ₹{safeToFixed(cogs, 0)}</span>
            </div>
            <div className="flex justify-between pb-2 border-b text-red-600">
              <span>Less: Shortfall/Variance</span>
              <span className="font-semibold">- ₹{safeToFixed(totalShortfall, 0)}</span>
            </div>
            <div className="flex justify-between pb-2 border-b text-orange-600">
              <span>Less: Expenses</span>
              <span className="font-semibold">- ₹{safeToFixed(totalExpenses, 0)}</span>
            </div>
            <div className={`flex justify-between pt-2 text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <span>= Net Profit / Loss</span>
              <span>₹{safeToFixed(profit, 0)}</span>
            </div>
            <div className="flex justify-between pt-2 text-xs text-muted-foreground">
              <span>Profit Margin</span>
              <span>{safeToFixed(profitMargin, 1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales & Expenses Grid */}
      {fuelTypeArray && fuelTypeArray.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales by Fuel Type</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={fuelTypeArray}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {fuelTypeArray.map((_entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`₹${safeToFixed(value, 2)}`, 'Amount']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sales Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {fuelTypeArray.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 pb-3 border-b last:pb-0 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                      <div>
                        <div className="text-sm font-medium">{f.name}</div>
                        <div className="text-xs text-muted-foreground">{safeToFixed(f.liters, 2)} L • {safeToFixed(f.percentage, 1)}%</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">₹{safeToFixed(f.value, 2)}</div>
                      <div className="text-xs text-muted-foreground">{f.count} txns</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Expenses Section */}
      {dailyExpenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              Daily Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.keys(expensesByCategory).length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold mb-4">Expenses by Category</h4>
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={Object.entries(expensesByCategory).map(([category, amount]) => ({
                        name: category,
                        amount: safeToFixed(amount, 2)
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
                        <YAxis />
                        <Tooltip formatter={(value: any) => `₹${value}`} />
                        <Bar dataKey="amount" fill="#f97316" name="Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Expense Details</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {dailyExpenses.map((expense: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between gap-4 pb-2 border-b last:border-0 text-sm">
                      <div>
                        <div className="font-medium">{expense.category || 'Other'}</div>
                        <div className="text-xs text-muted-foreground">{expense.description || 'No description'}</div>
                      </div>
                      <div className="text-right font-semibold">₹{safeToFixed(expense.amount || 0, 2)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex justify-between items-center font-semibold text-base">
                  <span>Total Expenses</span>
                  <span className="text-orange-600">₹{safeToFixed(totalExpenses, 0)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shortfalls/Variance Section */}
      {shortfalls.length > 0 && totalShortfall !== 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              Shortfalls & Variance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {shortfalls.map((shortfall: any, idx: number) => {
                const variance = shortfall.variance || 0;
                const isNegative = variance < 0;
                return (
                  <div key={idx} className="flex items-center justify-between gap-4 pb-3 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium">{shortfall.settlementType || 'Settlement'}</div>
                      <div className="text-xs text-muted-foreground">
                        {shortfall.settlementDate && new Date(shortfall.settlementDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div className={`text-right font-semibold ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                      {isNegative ? '-' : ''}₹{safeToFixed(Math.abs(variance), 2)}
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 border-t flex justify-between items-center font-semibold text-base">
                <span>Total Shortfall</span>
                <span className="text-red-600">₹{safeToFixed(totalShortfall, 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print Footer */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t">
        <p className="print:block hidden">Generated on {new Date().toLocaleString('en-IN')}</p>
      </div>
    </div>
  );
}
