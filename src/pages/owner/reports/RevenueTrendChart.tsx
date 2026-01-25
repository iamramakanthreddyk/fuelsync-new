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
          <CardTitle className="flex items-center gap-2 text-xs sm:text-sm md:text-lg">
            <LineChartIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            Revenue Trend
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Daily revenue over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 sm:h-56 md:h-72 lg:h-80 flex items-center justify-center">
            <div className="text-xs sm:text-sm text-muted-foreground">Loading revenue data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xs sm:text-sm md:text-lg">
            <LineChartIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            Revenue Trend
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Daily revenue over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 sm:h-56 md:h-72 lg:h-80 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-dashed border-blue-200">
            <div className="text-center p-3 sm:p-4">
              <LineChartIcon className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 mx-auto text-blue-400 mb-2 sm:mb-3" />
              <p className="text-blue-600 font-medium text-xs sm:text-sm md:text-base">
                No Revenue Data
              </p>
              <p className="text-xs sm:text-sm text-blue-500 mt-1">
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
        <CardTitle className="flex items-center gap-2 text-xs sm:text-sm md:text-lg">
          <LineChartIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
          Revenue Trend
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">Daily revenue over the selected period</CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:p-2">
        <div className="w-full h-48 sm:h-56 md:h-72 lg:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData}
              margin={{ top: 5, right: 10, left: 20, bottom: chartData.length > 10 ? 60 : 15 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#666' }}
                interval={chartData.length > 15 ? 1 : 0}
                angle={chartData.length > 10 ? -45 : 0}
                textAnchor={chartData.length > 10 ? "end" : "middle"}
                height={chartData.length > 10 ? 60 : 30}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#666' }}
                width={38}
                tickFormatter={(value) => `₹${safeToFixed(value / 1000, 0)}K`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-2 sm:p-3 border border-gray-200 rounded-lg shadow-lg text-xs sm:text-sm">
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
                dot={{ fill: '#2563eb', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
