/**
 * Today's Sales Breakdown Card
 * Shows payment method split: Cash, Online, Credit
 * - Percentage breakdown
 * - Bar chart visualization
 * - Amount in each category
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient, ApiResponse } from '@/lib/api-client';

interface DailySalesData {
  date: string;
  cash: number;
  online: number;
  credit: number;
}

interface SalesBreakdown {
  cash: number;
  online: number;
  credit: number;
  total: number;
}

export function TodaysSalesBreakdown() {
  const [breakdown, setBreakdown] = useState<SalesBreakdown>({
    cash: 0,
    online: 0,
    credit: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch today's sales
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const fetchTodaysSales = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        // Fetch daily sales breakdown
        const response: ApiResponse<any> = await apiClient.get(
          `/analytics/daily?startDate=${today}&endDate=${today}`
        );

        if (response.success && response.data) {
          // API returns { summary, items } structure
          const summary = response.data.summary || response.data;
          
          const totals = {
            cash: parseFloat(summary.breakdown?.cash || 0),
            online: parseFloat(summary.breakdown?.online || 0),
            credit: parseFloat(summary.breakdown?.credit || 0),
            total: 0,
          };

          totals.total = totals.cash + totals.online + totals.credit;
          setBreakdown(totals);
        } else {
          setBreakdown({
            cash: 0,
            online: 0,
            credit: 0,
            total: 0,
          });
        }
      } catch (err) {
        console.error('Error fetching sales data:', err);
        setError('Failed to load sales data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTodaysSales();
  }, []);

  const getCashPercent = breakdown.total > 0 ? (breakdown.cash / breakdown.total) * 100 : 0;
  const getOnlinePercent = breakdown.total > 0 ? (breakdown.online / breakdown.total) * 100 : 0;
  const getCreditPercent = breakdown.total > 0 ? (breakdown.credit / breakdown.total) * 100 : 0;

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Today's Sales Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-sm text-muted-foreground">Loading sales data...</div>
        ) : error ? (
          <div className="text-center py-4 text-sm text-red-600">{error}</div>
        ) : breakdown.total === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">No sales recorded today</div>
        ) : (
          <div className="space-y-4">
            {/* Total Sales */}
            <div className="text-center pb-3 border-b">
              <div className="text-3xl font-bold text-primary">
                {formatCurrency(breakdown.total)}
              </div>
              <div className="text-sm text-muted-foreground">Total Sales</div>
            </div>

            {/* Payment Methods */}
            <div className="space-y-3">
              {/* Cash */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Cash</span>
                  <span className="text-sm font-semibold text-green-600">
                    {getCashPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${getCashPercent}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(breakdown.cash)}
                </div>
              </div>

              {/* Online */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Online</span>
                  <span className="text-sm font-semibold text-blue-600">
                    {getOnlinePercent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${getOnlinePercent}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(breakdown.online)}
                </div>
              </div>

              {/* Credit */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Credit</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {getCreditPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all"
                    style={{ width: `${getCreditPercent}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(breakdown.credit)}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-3 text-xs text-muted-foreground border-t pt-3 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Cash
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Online
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                Credit
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
