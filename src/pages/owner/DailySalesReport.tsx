/**
 * Daily Sales Report Page
 * Comprehensive daily analytics and sales breakdown
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Tooltip as UITooltip } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { safeToFixed } from '@/lib/format-utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, ArrowLeft, Building2, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// aggregation is done inline from API rows below

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

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];


export default function DailySalesReport() {
  const navigate = useNavigate();
  const selectedDate = new Date().toISOString().split('T')[0];

  // Fetch raw sales readings
  const { data: apiResponse, isLoading } = useQuery({
    queryKey: ['sales-report', selectedDate],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: any[] }>(`/analytics/sales?startDate=${selectedDate}&endDate=${selectedDate}`);
      // Unwrap axios-like responses: response.data may be { success, data: [...] }
      const payload = (response as any)?.data ?? response;
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
      return rows;
    }
  });

  // Extract data from response - handle various response formats
  const responseData = apiResponse;

  // Helper to extract rows array from various API shapes
  const tryExtractRows = (obj: any): any[] | undefined => {
    if (!obj) return undefined;
    if (Array.isArray(obj)) return obj;
    if (obj.data && Array.isArray(obj.data)) return obj.data;
    if (obj.data && obj.data.data && Array.isArray(obj.data.data)) return obj.data.data;
    if (obj.rows && Array.isArray(obj.rows)) return obj.rows;
    return undefined;
  };

  const extractedRows = tryExtractRows(responseData) ?? [];

  // Normalize response into an array of DailySalesReportData regardless of API shape
  const normalizedReports: DailySalesReportData[] = (() => {
    const rows = extractedRows;
    if (!rows || rows.length === 0) return [];

    // If already aggregated (has byFuelType)
    if ((rows[0] as any).byFuelType) return rows as DailySalesReportData[];

    // If raw rows (camelCase keys) aggregate them into DailySalesReportData
    if ((rows[0] as any).stationId) {
      const map: Record<string, DailySalesReportData> = {};
      rows.forEach((r: any) => {
        const key = `${r.stationId}::${r.readingDate}`;
        if (!map[key]) {
          map[key] = {
            date: r.readingDate,
            stationId: r.stationId,
            stationName: r.stationName,
            totalSaleValue: 0,
            totalLiters: 0,
            readingsCount: 0,
            byFuelType: {}
          };
        }
        const entry = map[key];
        const volume = Number(r.deltaVolumeL) || 0;
        const amount = Number(r.totalAmount) || 0;
        entry.totalLiters += volume;
        entry.totalSaleValue += amount;
        entry.readingsCount += 1;
        const fuel = r.fuelType || 'unknown';
        if (!entry.byFuelType[fuel]) entry.byFuelType[fuel] = { value: 0, liters: 0, count: 0 };
        entry.byFuelType[fuel].value += amount;
        entry.byFuelType[fuel].liters += volume;
        entry.byFuelType[fuel].count += 1;
      });
      return Object.values(map);
    }

    // Unknown shape: return empty
    return [];
  })();

  const isValidData = normalizedReports.length > 0;

  // Selected station id state
  const [selectedStationId, setSelectedStationId] = useState<string>('');

  // When response data arrives, set a default station if none selected
  useEffect(() => {
    if (isValidData && !selectedStationId && normalizedReports.length > 0) {
      setSelectedStationId(normalizedReports[0].stationId || '');
    }
  }, [isValidData, normalizedReports, selectedStationId]);
  // Build station options from normalized reports
  const stationOptions = normalizedReports.map(r => ({ id: String(r.stationId), name: r.stationName }));

  const report = isValidData
    ? normalizedReports.find(r => String(r.stationId) === String(selectedStationId)) || normalizedReports[0]
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
      <div className="flex flex-col gap-4 print:mb-4">
        {/* Top row: Back, Title, Export */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
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
            <h1 className="text-2xl sm:text-3xl font-bold whitespace-nowrap">Daily Sales Report</h1>
          </div>
          <UITooltip>
            <Button
              onClick={handleExportPDF}
              className="print:hidden"
              variant="outline"
              size="icon"
              aria-label="Export PDF"
            >
              <Printer className="w-4 h-4" />
            </Button>
            <span className="text-xs bg-gray-700 text-white rounded px-2 py-1 absolute left-10 top-1/2 -translate-y-1/2 hidden group-hover:block">Export PDF</span>
          </UITooltip>
        </div>

        {/* Bottom row: Station selector and date info */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0">
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
          <div className="flex items-center gap-2 mt-2 md:mt-0">
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

      {/* Sales by Fuel Type */}
      {fuelTypeArray && fuelTypeArray.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="order-2 md:order-1">
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-2">Sales by Fuel Type</h3>
              <div className="w-full h-48">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={fuelTypeArray}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {fuelTypeArray.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`₹${safeToFixed(value, 2)}`, 'Amount']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="order-1 md:order-2">
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-2">Breakdown</h3>
              <div className="space-y-2">
                {fuelTypeArray.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                      <div>
                        <div className="text-sm font-medium">{f.name}</div>
                        <div className="text-xs text-muted-foreground">{safeToFixed(f.liters, 2)} L • {safeToFixed(f.percentage, 1)}%</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">₹{safeToFixed(f.value, 2)}</div>
                      <div className="text-xs text-muted-foreground">{f.count} txns</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      {/* Print Footer */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t">
        <p className="print:block hidden">Generated on {new Date().toLocaleString('en-IN')}</p>
      </div>
    </div>
  );
}
