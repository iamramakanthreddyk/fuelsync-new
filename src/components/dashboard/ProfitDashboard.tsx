import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IndianRupee, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { safeToFixed } from '@/lib/format-utils';

interface ProfitSummary {
  month: string;
  summary: {
    totalRevenue: number;
    totalCostOfGoods: number;
    totalExpenses: number;
    pendingExpenses?: number;
    grossProfit: number;
    netProfit: number;
    profitMargin: number;
    totalLitres: number;
    profitPerLitre: number;
  };
  breakdown: {
    byFuelType: Record<string, {
      revenue: number;
      costOfGoods: number;
      litres: number;
      profitPerLitre: number | null;
      profitMargin: number | null;
      hasCompleteData?: boolean;
    }>;
    byExpenseCategory: Array<{ category: string; label?: string; amount: number }>;
    readingDetails?: Record<string, {
      withCostPrice: Array<{
        date: string;
        litres: number;
        salePrice: number;
        costPrice: number;
        revenue: number;
        cogs: number;
        profit: number;
      }>;
      withoutCostPrice: Array<{
        date: string;
        litres: number;
        salePrice: number;
        revenue: number;
        note: string;
      }>;
    }>;
  };
  dataCompleteness: {
    totalReadings: number;
    readingsUsedForCalculation: number;
    readingsExcluded: number;
    completenessPercentage: number;
    note: string;
  };
}

interface ProfitDashboardProps {
  stationId: string;
}

const getMonthLabel = (monthStr: string) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const ProfitDashboard: React.FC<ProfitDashboardProps> = ({ stationId }) => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  
  const { data: profitData, isLoading, error } = useQuery({
    queryKey: ['profit-summary', stationId, selectedMonth],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: ProfitSummary }>(
        `/stations/${stationId}/profit-summary?month=${selectedMonth}`
      );
      return response.data as ProfitSummary;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Generate last 12 months
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }).reverse();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load profit data</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Month Selector - Compact */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
        <label className="text-sm font-medium">Select Month:</label>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {getMonthLabel(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Loading profit data...</p>
          </CardContent>
        </Card>
      ) : profitData ? (
        <>
          {/* Data Completeness Alert - Simplified */}
          {profitData.dataCompleteness.completenessPercentage < 100 && (
            <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Incomplete data:</strong> Profit calculated from {profitData.dataCompleteness.completenessPercentage}% of readings. Set fuel purchase prices for accurate calculations.
              </AlertDescription>
            </Alert>
          )}

          {/* Key Metrics - Owner Focused */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Net Profit - Most Important */}
            <Card className={`border-2 ${profitData.summary.netProfit >= 0 ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Net Profit</p>
                    <p className={`text-2xl font-bold ${profitData.summary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      ₹{safeToFixed(Math.abs(profitData.summary.netProfit), 0)}
                    </p>
                  </div>
                  {profitData.summary.netProfit >= 0 ? (
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {safeToFixed(profitData.summary.profitMargin, 1)}% margin
                </p>
              </CardContent>
            </Card>

            {/* Revenue */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                    <p className="text-2xl font-bold">₹{safeToFixed(profitData.summary.totalRevenue, 0)}</p>
                  </div>
                  <IndianRupee className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {safeToFixed(profitData.summary.totalLitres, 0)}L sold
                </p>
              </CardContent>
            </Card>

            {/* Total Costs */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Costs</p>
                    <p className="text-xl font-bold">₹{safeToFixed(profitData.summary.totalCostOfGoods + profitData.summary.totalExpenses, 0)}</p>
                  </div>
                  <AlertCircle className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Fuel: ₹{safeToFixed(profitData.summary.totalCostOfGoods, 0)}
                  {profitData.summary.totalExpenses > 0 && ` · Expenses: ₹${safeToFixed(profitData.summary.totalExpenses, 0)}`}
                </p>
              </CardContent>
            </Card>

            {/* Fuel Profit per Litre */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Profit/L</p>
                    <p className="text-2xl font-bold text-blue-700">₹{safeToFixed(profitData.summary.profitPerLitre, 1)}</p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Per litre sold
                </p>
              </CardContent>
            </Card>
          </div>

          {/* P&L Waterfall — Revenue → Gross Profit → Expenses → Net Profit */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">P&L Statement</CardTitle>
              <CardDescription>{getMonthLabel(selectedMonth)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                {/* Revenue */}
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Total Revenue</span>
                  <span className="font-semibold">₹{safeToFixed(profitData.summary.totalRevenue, 0)}</span>
                </div>
                {/* Fuel cost */}
                <div className="flex justify-between py-1.5 pl-4 text-muted-foreground">
                  <span>− Fuel Cost (COGS)</span>
                  <span className="text-red-600">₹{safeToFixed(profitData.summary.totalCostOfGoods, 0)}</span>
                </div>
                {/* Gross profit */}
                <div className={`flex justify-between py-2 border-t border-b font-semibold ${
                  profitData.summary.grossProfit >= 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  <span>= Gross Profit</span>
                  <span>₹{safeToFixed(profitData.summary.grossProfit, 0)}</span>
                </div>
                {/* Operating expenses */}
                {profitData.summary.totalExpenses > 0 && (
                  <div className="flex justify-between py-1.5 pl-4 text-muted-foreground">
                    <span>− Operating Expenses</span>
                    <span className="text-red-600">₹{safeToFixed(profitData.summary.totalExpenses, 0)}</span>
                  </div>
                )}
                {/* Pending notice */}
                {(profitData.summary.pendingExpenses ?? 0) > 0 && (
                  <div className="flex justify-between py-1 pl-4 text-xs text-amber-600">
                    <span>⏳ Pending approval (excluded)</span>
                    <span>₹{safeToFixed(profitData.summary.pendingExpenses!, 0)}</span>
                  </div>
                )}
                {/* Net profit */}
                <div className={`flex justify-between py-2 border-t mt-1 font-bold text-base ${
                  profitData.summary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  <span>= Net Profit</span>
                  <span>₹{safeToFixed(Math.abs(profitData.summary.netProfit), 0)}{profitData.summary.netProfit < 0 ? ' (Loss)' : ''}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1 text-right">
                  {safeToFixed(profitData.summary.profitMargin, 1)}% net margin · ₹{safeToFixed(profitData.summary.profitPerLitre, 1)}/L
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Fuel Type Performance - Simplified */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Fuel Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(profitData.breakdown.byFuelType).map(([fuelType, data]) => (
                  <div key={fuelType} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{fuelType}</span>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {safeToFixed(data.litres, 0)}L
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Revenue: ₹{safeToFixed(data.revenue, 0)}
                      </div>
                    </div>
                    <div className="text-right">
                      {data.profitMargin !== null ? (
                        <div className="text-green-700 font-bold">
                          ₹{safeToFixed(data.profitPerLitre || 0, 1)}/L
                        </div>
                      ) : (
                        <div className="text-amber-600 text-sm">
                          Set cost price
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {data.profitMargin !== null ? `${safeToFixed(data.profitMargin, 1)}% margin` : 'No data'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Expenses Summary - Only if there are expenses */}
          {profitData.breakdown.byExpenseCategory.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Operating Expenses Breakdown</CardTitle>
                <CardDescription>
                  Approved only · Total: ₹{safeToFixed(profitData.summary.totalExpenses, 0)}
                  {(profitData.summary.pendingExpenses ?? 0) > 0 && (
                    <span className="ml-2 text-amber-600">
                      · ₹{safeToFixed(profitData.summary.pendingExpenses!, 0)} pending (not counted)
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {profitData.breakdown.byExpenseCategory.map((expense) => (
                    <div key={expense.category} className="flex justify-between items-center p-2 border rounded">
                      <span className="text-sm">{expense.label ?? expense.category}</span>
                      <span className="font-medium">₹{safeToFixed(expense.amount, 0)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
};
