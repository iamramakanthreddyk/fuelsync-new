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
    byExpenseCategory: Array<{ category: string; amount: number }>;
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
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="flex gap-4 items-center">
        <label className="text-sm font-medium">Select Month:</label>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
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
          {/* Data Completeness Alert */}
          {profitData.dataCompleteness.completenessPercentage < 100 && (
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <strong>Profit calculated from {profitData.dataCompleteness.readingsUsedForCalculation}/{profitData.dataCompleteness.totalReadings} readings only.</strong> {profitData.dataCompleteness.readingsExcluded} readings excluded (missing cost price). Only sales with BOTH cost and sale price data are included.
              </AlertDescription>
            </Alert>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revenue */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {safeToFixed(profitData.summary.totalRevenue, 2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {safeToFixed(profitData.summary.totalLitres, 1)}L @ ₹{safeToFixed(profitData.summary.totalRevenue / profitData.summary.totalLitres, 2)}/L avg
                </p>
              </CardContent>
            </Card>

            {/* Cost of Goods */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cost of Goods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {safeToFixed(profitData.summary.totalCostOfGoods, 2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {profitData.dataCompleteness.completenessPercentage}% data complete
                </p>
              </CardContent>
            </Card>

            {/* Total Expenses */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {safeToFixed(profitData.summary.totalExpenses, 2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {profitData.dataCompleteness.totalReadings} readings
                </p>
              </CardContent>
            </Card>

            {/* Net Profit */}
            <Card className={profitData.summary.netProfit >= 0 ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {profitData.summary.netProfit >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-2xl font-bold ${profitData.summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {safeToFixed(profitData.summary.netProfit, 2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {safeToFixed(profitData.summary.profitMargin, 2)}% margin
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown by Fuel Type */}
          <Card>
            <CardHeader>
              <CardTitle>Breakdown by Fuel Type</CardTitle>
              <CardDescription>Revenue, cost, and profit per fuel type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(profitData.breakdown.byFuelType).map(([fuelType, data]) => (
                  <div key={fuelType} className={`border rounded-lg p-3 ${!data.profitMargin && data.profitMargin !== 0 ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">{fuelType}</h4>
                      <span className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                        {safeToFixed(data.litres, 1)}L
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Revenue:</span>
                        <p className="font-medium">₹{safeToFixed(data.revenue, 2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cost:</span>
                        <p className="font-medium">₹{safeToFixed(data.costOfGoods, 2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Profit:</span>
                        {data.profitMargin !== null ? (
                          <p className="font-medium text-green-600">₹{safeToFixed(data.profitPerLitre ? data.profitPerLitre * data.litres : 0, 2)}</p>
                        ) : (
                          <p className="font-medium text-amber-600">—</p>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Margin:</span>
                        {data.profitMargin !== null ? (
                          <p className="font-medium">{safeToFixed(data.profitMargin, 2)}%</p>
                        ) : (
                          <p className="font-medium text-amber-600 text-xs">No cost data</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Expenses by Category */}
          {profitData.breakdown.byExpenseCategory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
                <CardDescription>Breakdown of operational expenses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {profitData.breakdown.byExpenseCategory.map((expense) => (
                    <div key={expense.category} className="flex justify-between items-center">
                      <span className="capitalize">{expense.category}</span>
                      <span className="font-medium">₹{safeToFixed(expense.amount, 2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Reading Breakdown - Only WITH Cost Price */}
          {profitData.breakdown.readingDetails && Object.keys(profitData.breakdown.readingDetails).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reading Details - Profit Calculation Basis</CardTitle>
                <CardDescription>
                  Only readings with BOTH sales price AND cost price are included in profit calculations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(profitData.breakdown.readingDetails).map(([fuelType, details]) => (
                  <div key={fuelType} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold capitalize text-base">{fuelType}</h4>
                      <div className="text-xs text-muted-foreground">
                        {details.withCostPrice.length > 0 && (
                          <span className="text-green-600 font-medium">
                            ✓ {details.withCostPrice.length} readings used
                          </span>
                        )}
                        {details.withoutCostPrice.length > 0 && (
                          <span className="ml-2 text-amber-600">
                            ✗ {details.withoutCostPrice.length} excluded (no cost price)
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Readings WITH Cost Price - Show Table */}
                    {details.withCostPrice.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-gray-50 dark:bg-gray-900">
                              <th className="text-left px-2 py-1">Date</th>
                              <th className="text-right px-2 py-1">Litres</th>
                              <th className="text-right px-2 py-1">Sale ₹/L</th>
                              <th className="text-right px-2 py-1">Cost ₹/L</th>
                              <th className="text-right px-2 py-1">Revenue</th>
                              <th className="text-right px-2 py-1">COGS</th>
                              <th className="text-right px-2 py-1">Profit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {details.withCostPrice.map((reading, idx) => (
                              <tr key={idx} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                                <td className="px-2 py-1">{reading.date}</td>
                                <td className="text-right px-2 py-1">{safeToFixed(reading.litres, 1)}</td>
                                <td className="text-right px-2 py-1">{safeToFixed(reading.salePrice, 2)}</td>
                                <td className="text-right px-2 py-1 font-medium">{safeToFixed(reading.costPrice, 2)}</td>
                                <td className="text-right px-2 py-1">₹{safeToFixed(reading.revenue, 2)}</td>
                                <td className="text-right px-2 py-1">₹{safeToFixed(reading.cogs, 2)}</td>
                                <td className="text-right px-2 py-1 text-green-600 font-medium">₹{safeToFixed(reading.profit, 2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
};
