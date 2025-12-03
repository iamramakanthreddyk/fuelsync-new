

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { TrendingUp, Fuel, BarChart3 } from 'lucide-react';
import { safeToFixed } from '@/lib/format-utils';
import { CHART_COLORS as COLORS } from '@/lib/constants';


interface SalesChartsProps {
  salesData: Sale[];
  isLoading?: boolean;
}

import type { NozzleReading as Sale } from '@/types/api';

export function SalesCharts({ salesData, isLoading }: SalesChartsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-[300px] bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Process data for daily trend

  type DailyTrend = { date: string; amount: number; volume: number; transactions: number };
  const dailyTrend = salesData.reduce<Record<string, DailyTrend>>((acc, sale) => {
    const s = sale as any;
    const created = s.createdAt ?? s.created_at;
    const date = new Date(created).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = { date, amount: 0, volume: 0, transactions: 0 };
    }
    const amt = parseFloat((s.totalAmount ?? s.total_amount ?? s.total_amount_str ?? 0).toString() || '0');
    const vol = parseFloat((s.litresSold ?? s.deltaVolumeL ?? s.delta_volume_l ?? s.litres ?? 0).toString() || '0');
    acc[date].amount += amt;
    acc[date].volume += vol;
    acc[date].transactions += 1;
    return acc;
  }, {});

  const dailyTrendData = Object.values(dailyTrend).sort((a, b) => a.date.localeCompare(b.date));

  // Process data for pump breakdown

  type PumpBreakdown = { pump: string; amount: number; volume: number; transactions: number };
  const pumpBreakdown = salesData.reduce<Record<string, PumpBreakdown>>((acc, sale) => {
    const s = sale as any;
    const pumpId = s.nozzle?.pumpId ?? s.nozzles?.pumpId ?? s.pumpId ?? s.pump_id ?? s.nozzles?.pumps?.pump_sno ?? 'Unknown';
    if (!acc[pumpId]) {
      acc[pumpId] = { pump: pumpId, amount: 0, volume: 0, transactions: 0 };
    }
    const amt = parseFloat((s.totalAmount ?? s.total_amount ?? 0).toString() || '0');
    const vol = parseFloat((s.litresSold ?? s.deltaVolumeL ?? s.delta_volume_l ?? 0).toString() || '0');
    acc[pumpId].amount += amt;
    acc[pumpId].volume += vol;
    acc[pumpId].transactions += 1;
    return acc;
  }, {});

  const pumpBreakdownData = Object.values(pumpBreakdown);

  // Process data for fuel type breakdown

  type FuelTypeBreakdown = { name: string; value: number; amount: number };
  const fuelTypeBreakdown = salesData.reduce<Record<string, FuelTypeBreakdown>>((acc, sale) => {
    const s = sale as any;
    const fuelType = s.nozzle?.fuelType ?? s.fuelType ?? s.fuel_type ?? s.nozzles?.fuel_type ?? 'Unknown';
    if (!acc[fuelType]) {
      acc[fuelType] = { name: fuelType, value: 0, amount: 0 };
    }
    const vol = parseFloat((s.litresSold ?? s.deltaVolumeL ?? s.delta_volume_l ?? 0).toString() || '0');
    const amt = parseFloat((s.totalAmount ?? s.total_amount ?? 0).toString() || '0');
    acc[fuelType].value += vol;
    acc[fuelType].amount += amt;
    return acc;
  }, {});

  const fuelTypeData = Object.values(fuelTypeBreakdown);

  // Hourly breakdown

  type HourlyBreakdown = { hour: string; amount: number; transactions: number };
  const hourlyBreakdown = salesData.reduce<Record<string, HourlyBreakdown>>((acc, sale) => {
    const s = sale as any;
    const created = s.createdAt ?? s.created_at;
    const hourNum = new Date(created).getHours();
    const hour = hourNum.toString();
    if (!acc[hour]) {
      acc[hour] = { hour: `${hourNum}:00`, amount: 0, transactions: 0 };
    }
    const amt = parseFloat((s.totalAmount ?? s.total_amount ?? 0).toString() || '0');
    acc[hour].amount += amt;
    acc[hour].transactions += 1;
    return acc;
  }, {});

  const hourlyData = Object.values(hourlyBreakdown).sort((a, b) => 
    parseInt(a.hour.split(':')[0]) - parseInt(b.hour.split(':')[0])
  );

  const chartConfig = {
    amount: {
      label: "Amount (₹)",
      color: "hsl(var(--chart-1))",
    },
    volume: {
      label: "Volume (L)",
      color: "hsl(var(--chart-2))",
    },
    transactions: {
      label: "Transactions",
      color: "hsl(var(--chart-3))",
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Daily Sales Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Daily Sales Trend
          </CardTitle>
          <CardDescription>Sales amount over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <LineChart data={dailyTrendData}>
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line 
                type="monotone" 
                dataKey="amount" 
                stroke="var(--color-amount)" 
                strokeWidth={2}
                dot={{ fill: "var(--color-amount)" }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Pump-wise Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Pump-wise Sales
          </CardTitle>
          <CardDescription>Sales breakdown by pump</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <BarChart data={pumpBreakdownData}>
              <XAxis dataKey="pump" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Fuel Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="w-5 h-5" />
            Fuel Type Distribution
          </CardTitle>
          <CardDescription>Volume by fuel type</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <PieChart>
              <Pie
                data={fuelTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${safeToFixed(percent * 100, 0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {fuelTypeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Hourly Sales Pattern */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Hourly Sales Pattern
          </CardTitle>
          <CardDescription>Sales throughout the day</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <BarChart data={hourlyData}>
              <XAxis dataKey="hour" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
