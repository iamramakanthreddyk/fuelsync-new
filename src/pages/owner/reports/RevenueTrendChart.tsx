import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart as LineChartIcon } from 'lucide-react';
import { safeToFixed } from '@/lib/format-utils';
import type { SalesReport } from '@/hooks/useReportData';

interface RevenueTrendChartProps {
  salesReports?: SalesReport[];
  isLoading?: boolean;
  className?: string;
}

export const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({
  salesReports = [],
  isLoading = false,
  className
}) => {
  // Process sales reports to create chart data
  const chartData = useMemo(() => {
    if (!salesReports || salesReports.length === 0) {
      return [];
    }

    // Group by date and sum total sales
    const dateMap = new Map<string, number>();

    salesReports.forEach(report => {
      const existing = dateMap.get(report.date) || 0;
      dateMap.set(report.date, existing + report.totalSales);
    });

    // Convert to array and sort by date
    return Array.from(dateMap.entries())
      .map(([date, revenue]) => ({
        date: new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        revenue: Math.round(revenue),
        fullDate: date // Keep full date for sorting
      }))
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
  }, [salesReports]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm md:text-lg">
            <LineChartIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            Revenue Trend
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Daily revenue over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 md:h-64 flex items-center justify-center">
            <div className="text-muted-foreground">Loading revenue data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm md:text-lg">
            <LineChartIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            Revenue Trend
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Daily revenue over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 md:h-64 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-dashed border-blue-200">
            <div className="text-center p-4">
              <LineChartIcon className="w-10 h-10 md:w-12 md:h-12 mx-auto text-blue-400 mb-3" />
              <p className="text-blue-600 font-medium text-sm md:text-base">
                No Revenue Data
              </p>
              <p className="text-xs md:text-sm text-blue-500">
                No sales data available for the selected period
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm md:text-lg">
          <LineChartIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
          Revenue Trend
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">Daily revenue over the selected period</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-32 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                className="text-xs"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                className="text-xs"
                tickFormatter={(value) => `₹${safeToFixed(value / 1000, 0)}K`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                        <p className="font-medium text-gray-900">{label}</p>
                        <p className="text-blue-600">
                          Revenue: ₹{safeToFixed(payload[0].value as number, 2)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
