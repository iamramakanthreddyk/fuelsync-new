
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { safeToFixed } from '@/lib/format-utils';

interface TrendsData {
  date: string;
  sales: number;
  payments: number;
}

interface TrendsChartProps {
  data: TrendsData[];
  isLoading?: boolean;
}

/** Compute a 3-day linear-regression forecast from the sales series */
function buildForecastData(historical: TrendsData[]): Array<TrendsData & { predicted?: number; isForecast?: boolean }> {
  if (historical.length < 2) return historical;

  const n = historical.length;
  const xs = historical.map((_, i) => i);
  const ys = historical.map((d) => d.sales);

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Tag historical rows (no predicted value)
  const result: Array<TrendsData & { predicted?: number; isForecast?: boolean }> = historical.map((d) => ({
    ...d,
    predicted: undefined,
  }));

  // Append 3 forecast days
  const lastDate = new Date(historical[n - 1].date);
  for (let i = 1; i <= 3; i++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setDate(lastDate.getDate() + i);
    const predictedSales = Math.max(0, Math.round(slope * (n - 1 + i) + intercept));
    result.push({
      date: forecastDate.toISOString().split('T')[0],
      sales: 0,
      payments: 0,
      predicted: predictedSales,
      isForecast: true,
    });
  }

  return result;
}

export const TrendsChart: React.FC<TrendsChartProps> = ({ data, isLoading }) => {
  const chartData = useMemo(() => buildForecastData(data), [data]);
  const todayStr = new Date().toISOString().split('T')[0];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            7-Day Sales Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground">Loading trends...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          7-Day Sales Trends
          <span className="ml-auto text-xs font-normal text-muted-foreground">Dashed = 3-day forecast</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'predicted') return [`₹${safeToFixed(value, 0)} (est.)`, 'Forecast'];
                  return [
                    `₹${safeToFixed(value, 2)}`,
                    name === 'sales' ? 'Sales' : 'Collections'
                  ];
                }}
                labelFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric'
                  });
                }}
              />
              <ReferenceLine x={todayStr} stroke="#94a3b8" strokeDasharray="4 2" label={{ value: 'Today', fill: '#94a3b8', fontSize: 11 }} />
              <Line 
                type="monotone" 
                dataKey="sales" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ r: 4 }}
                name="sales"
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="payments" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ r: 4 }}
                name="payments"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 4, fill: '#f59e0b' }}
                name="predicted"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Forecast based on linear trend of the last 7 days. Actual results may vary.
        </p>
      </CardContent>
    </Card>
  );
};
