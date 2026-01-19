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
import { Download, ArrowLeft, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { aggregateRawReadingsToSalesReports } from '@/hooks/useReportData';

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

/**
 * Convert aggregated SalesReport format to DailySalesReportData format
 */
function convertSalesReportToDailyReport(salesReports: any[]): DailySalesReportData[] {
  return salesReports.map(report => {
    const byFuelType: Record<string, FuelTypeData> = {};
    
    // Build fuel type breakdown
    if (report.fuelTypeSales && Array.isArray(report.fuelTypeSales)) {
      report.fuelTypeSales.forEach((fuel: any) => {
        byFuelType[fuel.fuelType] = {
          value: fuel.sales,
          liters: fuel.quantity,
          count: fuel.transactions
        };
      });
    }
    
    return {
      date: report.date,
      stationId: report.stationId,
      stationName: report.stationName,
      totalSaleValue: report.totalSales,
      totalLiters: report.totalQuantity,
      readingsCount: report.totalTransactions,
      byFuelType
    };
  });
}

export default function DailySalesReport() {
  const navigate = useNavigate();
  const selectedDate = new Date().toISOString().split('T')[0];

  // Fetch raw sales readings and aggregate them
  const { data: apiResponse, isLoading } = useQuery({
    queryKey: ['sales-report', selectedDate],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: any[] }>(
        `/analytics/sales?startDate=${selectedDate}&endDate=${selectedDate}`
      );
      
      // Extract raw readings
      const rawReadings = response?.data || [];
      
      // Aggregate into SalesReport format
      const aggregated = aggregateRawReadingsToSalesReports(rawReadings);
      
      // Convert to DailySalesReportData format
      const dailyReports = convertSalesReportToDailyReport(aggregated);
      
      return { success: true, data: dailyReports };
    }
  });

  // Extract data from response - handle various response formats
  const responseData = apiResponse?.data;
  const isValidData = responseData && Array.isArray(responseData) && responseData.length > 0;

  // Always call useState, even if data is not valid
  const [selectedStationId, setSelectedStationId] = useState<string>(
    isValidData ? responseData[0]?.stationId || '' : ''
  );

  // These depend on responseData, but are safe if it's empty
  const stationOptions = isValidData ? responseData.map(r => ({ id: r.stationId, name: r.stationName })) : [];
  const report = isValidData
    ? responseData.find(r => r.stationId === selectedStationId) || responseData[0]
    : undefined;

  // Convert byFuelType object to array for charts
  const fuelTypeArray = report && report.byFuelType
    ? Object.entries(report.byFuelType).map(([name, data]) => {
        const total = report.totalSaleValue;
        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          liters: data.liters,
          value: data.value,
          count: data.count,
          percentage: total > 0 ? (data.value / total) * 100 : 0
        };
      })
    : [];

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

  if (!isValidData || !report) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No data available for this date</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }


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
            <div className="flex flex-row items-center gap-6 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold whitespace-nowrap">Daily Sales Report</h1>
              {/* Station Selector - horizontally aligned */}
              <div className="flex flex-col justify-center">
                <label htmlFor="station-select" className="text-muted-foreground text-sm font-medium mb-1 text-center">Station</label>
                <div className="relative flex items-center bg-white border border-gray-200 rounded-lg px-3 py-2 min-w-[170px] max-w-[200px] shadow-sm">
                  <Building2 className="w-5 h-5 text-gray-400 mr-2" />
                  <select
                    id="station-select"
                    className="appearance-none bg-transparent outline-none text-base font-semibold flex-1 pr-6"
                    value={selectedStationId}
                    onChange={e => setSelectedStationId(e.target.value)}
                  >
                    {stationOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                  <svg className="w-4 h-4 text-gray-400 absolute right-3 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-base font-semibold text-primary">{report!.stationName}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground text-sm">
                {new Date(report!.date).toLocaleDateString('en-IN', {
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
            <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-green-600 break-words">
              ₹{report!.totalSaleValue >= 100000 
                ? `${safeToFixed(report!.totalSaleValue / 100000, 1)}L`
                : safeToFixed(report!.totalSaleValue, 2)}
            </div>
            <div className="text-xs text-muted-foreground mt-2 truncate">Today's revenue</div>
          </CardContent>
        </Card>

        <Card className="flex-1 overflow-hidden min-w-[220px] md:min-w-[260px] xl:min-w-[340px]">
          <CardContent className="p-6">
            <div className="text-xs md:text-sm text-muted-foreground mb-1 truncate">Total Liters</div>
            <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-blue-600 break-words">
              {report!.totalLiters >= 1000 
                ? `${safeToFixed(report!.totalLiters / 1000, 1)}K L`
                : `${safeToFixed(report!.totalLiters, 2)} L`}
            </div>
            <div className="text-xs text-muted-foreground mt-2 truncate">Fuel dispensed</div>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Fuel Type section removed as requested - data was unusable/dummy */}


      {/* Print Footer */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t">
        <p className="print:block hidden">Generated on {new Date().toLocaleString('en-IN')}</p>
      </div>
    </div>
  );
}
