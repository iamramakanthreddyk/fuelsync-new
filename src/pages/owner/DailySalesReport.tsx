/**
 * Daily Sales Report Page
 * Comprehensive daily analytics and sales breakdown
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { safeToFixed } from '@/lib/format-utils';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  Download,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

interface ApiResponse {
  success: boolean;
  data: DailySalesReportData[];
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

export default function DailySalesReport() {
  const navigate = useNavigate();
  const selectedDate = new Date().toISOString().split('T')[0];

  // Fetch sales report
  const { data: apiResponse, isLoading } = useQuery({
    queryKey: ['sales-report', selectedDate],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse>(
        `/reports/daily-sales?date=${selectedDate}`
      );
      // Ensure we always return the full response
      return response;
    }
  });

  const handleExportPDF = () => {
    // PDF export functionality
    window.print();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">Loading report...</div>
      </div>
    );
  }

  // Extract data from response - handle various response formats
  const responseData = apiResponse?.data;
  const isValidData = responseData && Array.isArray(responseData) && responseData.length > 0;

  if (!isValidData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No data available for this date</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  // Get the first (or only) station's report
  const report = responseData[0];

  // Convert byFuelType object to array for charts
  const fuelTypeArray = Object.entries(report.byFuelType).map(([name, data]) => {
    const total = report.totalSaleValue;
    return {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      liters: data.liters,
      value: data.value,
      count: data.count,
      percentage: total > 0 ? (data.value / total) * 100 : 0
    };
  });

  // Calculate average price per liter
  const avgPrice = report.totalLiters > 0 ? report.totalSaleValue / report.totalLiters : 0;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl print:p-4">
      {/* Header */}
      <div className="flex items-center justify-between print:mb-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="print:hidden"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Daily Sales Report</h1>
            <p className="text-muted-foreground">
              {report.stationName} • {new Date(report.date).toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>
        <Button
          onClick={handleExportPDF}
          className="print:hidden"
          variant="outline"
        >
          <Download className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="overflow-hidden">
          <CardContent className="p-4 md:p-6">
            <div className="text-xs md:text-sm text-muted-foreground mb-1 truncate">Total Sale Value</div>
            <div className="text-xl md:text-2xl lg:text-3xl font-bold text-green-600 break-all md:break-normal">
              ₹{report.totalSaleValue >= 100000 
                ? `${safeToFixed(report.totalSaleValue / 100000, 1)}L`
                : safeToFixed(report.totalSaleValue, 2)}
            </div>
            <div className="text-xs text-muted-foreground mt-2 truncate">Today's revenue</div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4 md:p-6">
            <div className="text-xs md:text-sm text-muted-foreground mb-1 truncate">Total Liters</div>
            <div className="text-xl md:text-2xl lg:text-3xl font-bold text-blue-600 break-all md:break-normal">
              {report.totalLiters >= 1000 
                ? `${safeToFixed(report.totalLiters / 1000, 1)}K L`
                : `${safeToFixed(report.totalLiters, 2)} L`}
            </div>
            <div className="text-xs text-muted-foreground mt-2 truncate">Fuel dispensed</div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4 md:p-6">
            <div className="text-xs md:text-sm text-muted-foreground mb-1 truncate">Avg Price</div>
            <div className="text-xl md:text-2xl lg:text-3xl font-bold text-purple-600 break-all md:break-normal">
              ₹{safeToFixed(avgPrice, 2)}/L
            </div>
            <div className="text-xs text-muted-foreground mt-2 truncate">Weighted average</div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4 md:p-6">
            <div className="text-xs md:text-sm text-muted-foreground mb-1 truncate">Readings</div>
            <div className="text-xl md:text-2xl lg:text-3xl font-bold text-orange-600 break-all md:break-normal">
              {report.readingsCount >= 1000 
                ? `${safeToFixed(report.readingsCount / 1000, 1)}K`
                : report.readingsCount.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-2 truncate">Total entries</div>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Fuel Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sales by Fuel Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={fuelTypeArray}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percentage }) => `${name} (${safeToFixed(percentage, 1)}%)`}
                  >
                    {fuelTypeArray.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `₹${safeToFixed(value, 2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Breakdown Table */}
            <div className="space-y-2">
              {fuelTypeArray.map((fuel, index) => (
                <div key={fuel.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{fuel.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">₹{safeToFixed(fuel.value, 2)}</div>
                    <div className="text-xs text-muted-foreground">{safeToFixed(fuel.liters, 2)} L</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Total Readings</div>
              <div className="text-2xl font-bold text-blue-600">{report.readingsCount}</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Total Fuel Type Variants</div>
              <div className="text-2xl font-bold text-green-600">{Object.keys(report.byFuelType).length}</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Average Per Liter</div>
              <div className="text-2xl font-bold text-purple-600">₹{safeToFixed(avgPrice, 2)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print Footer */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t">
        <p className="print:block hidden">Generated on {new Date().toLocaleString('en-IN')}</p>
      </div>
    </div>
  );
}
