/**
 * Daily Sales Report Page
 * Comprehensive daily analytics and sales breakdown
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Tooltip as UITooltip } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { safeToFixed } from '@/lib/format-utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, ArrowLeft } from 'lucide-react';
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


  // Add station selector state
  const [selectedStationId, setSelectedStationId] = useState<string>(responseData[0]?.stationId || '');
  const stationOptions = responseData.map(r => ({ id: r.stationId, name: r.stationName }));
  const report = responseData.find(r => r.stationId === selectedStationId) || responseData[0];

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


  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl print:p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between print:mb-4 gap-4 md:gap-0">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <UITooltip>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="print:hidden border border-gray-200 hover:border-gray-400"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="text-xs bg-gray-700 text-white rounded px-2 py-1 absolute left-10 top-1/2 -translate-y-1/2 hidden group-hover:block">Back</span>
          </UITooltip>
          <div className="flex flex-col gap-1 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold whitespace-nowrap">Daily Sales Report</h1>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <label htmlFor="station-select" className="text-muted-foreground text-sm font-medium">Station:</label>
                <select
                  id="station-select"
                  className="border rounded px-2 py-1 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedStationId}
                  onChange={e => setSelectedStationId(e.target.value)}
                >
                  {stationOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-base font-semibold text-primary">{report.stationName}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground text-sm">
                {new Date(report.date).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </div>
          </div>
        </div>
        <Button
          onClick={handleExportPDF}
          className="print:hidden mt-2 md:mt-0"
          variant="outline"
        >
          <Download className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="w-full flex flex-col md:flex-row gap-4 md:gap-6 mb-4">
        <Card className="flex-1 overflow-hidden min-w-[220px] md:min-w-[260px] xl:min-w-[340px]">
          <CardContent className="p-6">
            <div className="text-xs md:text-sm text-muted-foreground mb-1 truncate">Total Sale Value</div>
            <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-green-600 break-all md:break-normal">
              ₹{report.totalSaleValue >= 100000 
                ? `${safeToFixed(report.totalSaleValue / 100000, 1)}L`
                : safeToFixed(report.totalSaleValue, 2)}
            </div>
            <div className="text-xs text-muted-foreground mt-2 truncate">Today's revenue</div>
          </CardContent>
        </Card>

        <Card className="flex-1 overflow-hidden min-w-[220px] md:min-w-[260px] xl:min-w-[340px]">
          <CardContent className="p-6">
            <div className="text-xs md:text-sm text-muted-foreground mb-1 truncate">Total Liters</div>
            <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-blue-600 break-all md:break-normal">
              {report.totalLiters >= 1000 
                ? `${safeToFixed(report.totalLiters / 1000, 1)}K L`
                : `${safeToFixed(report.totalLiters, 2)} L`}
            </div>
            <div className="text-xs text-muted-foreground mt-2 truncate">Fuel dispensed</div>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Fuel Type */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 md:p-6 md:pb-2">
          <div className="flex flex-row gap-6 items-center mr-4 w-full max-w-md">
            <div className="flex-1 flex flex-col items-center justify-center p-4 bg-green-50 rounded-lg border border-green-100 min-w-0">
              <div className="text-xs text-muted-foreground mb-1 truncate">Fuel Types</div>
              <div className="text-2xl md:text-3xl font-extrabold text-green-700 break-all">{Object.keys(report.byFuelType).length}</div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-4 bg-orange-50 rounded-lg border border-orange-100 min-w-0">
              <div className="text-xs text-muted-foreground mb-1 truncate">Readings</div>
              <div className="text-2xl md:text-3xl font-extrabold text-orange-700 break-all">
                {report.readingsCount >= 1000 
                  ? `${safeToFixed(report.readingsCount / 1000, 1)}K`
                  : report.readingsCount.toLocaleString()}
              </div>
            </div>
          </div>
          <CardTitle className="text-lg flex-1">Sales by Fuel Type</CardTitle>
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


      {/* Print Footer */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t">
        <p className="print:block hidden">Generated on {new Date().toLocaleString('en-IN')}</p>
      </div>
    </div>
  );
}
