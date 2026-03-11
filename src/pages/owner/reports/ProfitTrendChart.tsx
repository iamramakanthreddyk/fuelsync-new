import React, { useMemo } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { SalesReport, Settlement } from '@/hooks/useReportData';
import type { Expense } from '@/types/api';
import { safeToFixed, formatCurrency } from '@/lib/format-utils';

interface ProfitTrendChartProps {
  salesReports?: SalesReport[];
  settlements?: Settlement[];
  expenses?: Expense[];
  isLoading?: boolean;
  className?: string;
}

interface DailyMetrics {
  date: string;
  revenue: number;
  cogs: number;
  shortfall: number;
  expenses: number;
  profit: number;
}

const calculateCOGS = (): number => {
  // If costPrice is available in fuelTypeSales, calculate COGS
  // For now, returning 0 as it needs backend support
  // This will be: sum of (quantity * costPrice) for each fuel type
  return 0;
};

export const ProfitTrendChart: React.FC<ProfitTrendChartProps> = ({
  salesReports = [],
  settlements = [],
  expenses = [],
  isLoading = false,
  className = '',
}) => {
  // Group and aggregate data by date
  const chartData = useMemo(() => {
    const dataMap = new Map<string, DailyMetrics>();

    // Process sales reports (revenue)
    salesReports.forEach((report) => {
      const date = report.date;
      const existing = dataMap.get(date) || { date, revenue: 0, cogs: 0, shortfall: 0, expenses: 0, profit: 0 };
      existing.revenue += report.totalSales || 0;
      existing.cogs += calculateCOGS();
      dataMap.set(date, existing);
    });

    // Process settlements (shortfall/variance)
    settlements.forEach((settlement) => {
      const date = settlement.date;
      const existing = dataMap.get(date) || { date, revenue: 0, cogs: 0, shortfall: 0, expenses: 0, profit: 0 };
      // Positive variance = shortage/loss, negative = overage/gain
      existing.shortfall += Math.max(0, settlement.variance || 0);
      dataMap.set(date, existing);
    });

    // Process expenses (approved only)
    expenses.forEach((exp: any) => {
      if (exp.approvalStatus === 'approved' || exp.approvalStatus === 'auto_approved') {
        const date = exp.date?.split('T')[0] || new Date().toISOString().split('T')[0];
        const existing = dataMap.get(date) || { date, revenue: 0, cogs: 0, shortfall: 0, expenses: 0, profit: 0 };
        existing.expenses += exp.amount || 0;
        dataMap.set(date, existing);
      }
    });

    // Calculate profit and sort by date
    const data = Array.from(dataMap.values())
      .map((item) => ({
        ...item,
        profit: item.revenue - item.cogs - item.shortfall - item.expenses,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return data;
  }, [salesReports, settlements, expenses]);

  // Calculate totals
  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, day) => ({
        revenue: acc.revenue + day.revenue,
        cogs: acc.cogs + day.cogs,
        shortfall: acc.shortfall + day.shortfall,
        expenses: acc.expenses + day.expenses,
        profit: acc.profit + day.profit,
      }),
      { revenue: 0, cogs: 0, shortfall: 0, expenses: 0, profit: 0 }
    );
  }, [chartData]);

  // Calculate net after expenses
  const profitMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Loading profit data...</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">No data available for the selected period</p>
        </CardContent>
      </Card>
    );
  }

  const isProfitable = totals.profit > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Formula: Profit = Revenue - COGS - Shortfall - Expenses */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
          <strong>Profit Formula:</strong> Revenue - COGS - Shortfall - Expenses = Profit
        </AlertDescription>
      </Alert>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Revenue */}
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase">Revenue</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(totals.revenue, 0)}</p>
              <p className="text-xs text-muted-foreground">Total sales</p>
            </div>
          </CardContent>
        </Card>

        {/* COGS */}
        {totals.cogs > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">COGS</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(totals.cogs, 0)}</p>
                <p className="text-xs text-muted-foreground">Cost of goods</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shortfall */}
        {totals.shortfall > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">Shortfall</p>
                <p className="text-lg font-bold text-orange-600">{formatCurrency(totals.shortfall, 0)}</p>
                <p className="text-xs text-muted-foreground">Cash variance</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expenses */}
        {totals.expenses > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">Expenses</p>
                <p className="text-lg font-bold text-red-600">₹{safeToFixed(totals.expenses, 0)}</p>
                <p className="text-xs text-muted-foreground">Approved opex</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profit */}
        <Card className={isProfitable ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <CardContent className="pt-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase">Profit</p>
              <div className="flex items-center gap-2">
                <p className={`text-lg font-bold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totals.profit, 0)}
                </p>
                {isProfitable ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{safeToFixed(profitMargin, 1)}% margin</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profit Trend Analysis</CardTitle>
          <CardDescription>Daily breakdown: Revenue - COGS - Shortfall - Expenses</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
                label={{ value: 'Amount (₹)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value, 0)}
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />

              {/* Revenue - Green */}
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
                activeDot={{ r: 6 }}
                name="Revenue"
              />

              {/* COGS - Brown (if present) */}
              {totals.cogs > 0 && (
                <Line
                  type="monotone"
                  dataKey="cogs"
                  stroke="#92400e"
                  strokeWidth={2}
                  dot={{ fill: '#92400e', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="COGS"
                />
              )}

              {/* Shortfall - Orange */}
              {totals.shortfall > 0 && (
                <Line
                  type="monotone"
                  dataKey="shortfall"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: '#f97316', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Shortfall"
                />
              )}

              {/* Expenses - Red */}
              {totals.expenses > 0 && (
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: '#ef4444', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Expenses"
                />
              )}

              {/* Profit - Blue */}
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 5 }}
                activeDot={{ r: 7 }}
                name="Profit (Bottom Line)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Profit Summary Card */}
      <Card className={isProfitable ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
        <CardHeader>
          <CardTitle className="text-sm">Profit Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-muted-foreground">Revenue:</span>
              <span className="font-semibold text-green-600">{formatCurrency(totals.revenue, 0)}</span>
            </div>
            {totals.cogs > 0 && (
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">- COGS:</span>
                <span className="font-semibold text-amber-600">({formatCurrency(totals.cogs, 0)})</span>
              </div>
            )}
            {totals.shortfall > 0 && (
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">- Shortfall:</span>
                <span className="font-semibold text-orange-600">({formatCurrency(totals.shortfall, 0)})</span>
              </div>
            )}
            {totals.expenses > 0 && (
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">- Expenses:</span>
                <span className="font-semibold text-red-600">({formatCurrency(totals.expenses, 0)})</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 font-bold">
              <span>= Profit:</span>
              <span className={isProfitable ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(totals.profit, 0)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground text-right mt-2">
              Profit Margin: {safeToFixed(profitMargin, 1)}%
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
