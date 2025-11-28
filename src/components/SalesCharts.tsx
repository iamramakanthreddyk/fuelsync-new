
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { TrendingUp, Fuel, BarChart3 } from 'lucide-react';

interface SalesChartsProps {
  salesData: any[];
  isLoading?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

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
  const dailyTrend = salesData.reduce((acc, sale) => {
    const date = new Date(sale.created_at).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = { date, amount: 0, volume: 0, transactions: 0 };
    }
    acc[date].amount += parseFloat(sale.total_amount || 0);
    acc[date].volume += parseFloat(sale.delta_volume_l || 0);
    acc[date].transactions += 1;
    return acc;
  }, {} as Record<string, any>);

  const dailyTrendData = Object.values(dailyTrend).sort((a: any, b: any) => a.date.localeCompare(b.date));

  // Process data for pump breakdown
  const pumpBreakdown = salesData.reduce((acc, sale) => {
    const pumpId = sale.nozzles?.pumps?.pump_sno || 'Unknown';
    if (!acc[pumpId]) {
      acc[pumpId] = { pump: pumpId, amount: 0, volume: 0, transactions: 0 };
    }
    acc[pumpId].amount += parseFloat(sale.total_amount || 0);
    acc[pumpId].volume += parseFloat(sale.delta_volume_l || 0);
    acc[pumpId].transactions += 1;
    return acc;
  }, {} as Record<string, any>);

  const pumpBreakdownData = Object.values(pumpBreakdown);

  // Process data for fuel type breakdown
  const fuelTypeBreakdown = salesData.reduce((acc, sale) => {
    const fuelType = sale.nozzles?.fuel_type || 'Unknown';
    if (!acc[fuelType]) {
      acc[fuelType] = { name: fuelType, value: 0, amount: 0 };
    }
    acc[fuelType].value += parseFloat(sale.delta_volume_l || 0);
    acc[fuelType].amount += parseFloat(sale.total_amount || 0);
    return acc;
  }, {} as Record<string, any>);

  const fuelTypeData = Object.values(fuelTypeBreakdown);

  // Hourly breakdown
  const hourlyBreakdown = salesData.reduce((acc, sale) => {
    const hour = new Date(sale.created_at).getHours();
    if (!acc[hour]) {
      acc[hour] = { hour: `${hour}:00`, amount: 0, transactions: 0 };
    }
    acc[hour].amount += parseFloat(sale.total_amount || 0);
    acc[hour].transactions += 1;
    return acc;
  }, {} as Record<string, any>);

  const hourlyData = Object.values(hourlyBreakdown).sort((a: any, b: any) => 
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
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {fuelTypeData.map((entry, index) => (
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
