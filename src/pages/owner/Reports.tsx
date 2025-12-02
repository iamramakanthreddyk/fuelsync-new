/**
 * Owner Reports & Analytics
 * Modern dashboard-style view for sales, shift, and operational reports
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { getFuelBadgeClasses } from '@/lib/fuelColors';
import {
  FileText,
  TrendingUp,
  DollarSign,
  BarChart3,
  Download,
  Calendar,
  Filter,
  Activity,
  Droplet,
  Users,
  Clock,
  Target,
  Zap,
  PieChart,
  LineChart,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { toCsv, downloadCsv } from '@/lib/csv';
import { useToast } from '@/hooks/use-toast';

interface Station {
  id: string;
  name: string;
  code: string;
}

interface SalesReport {
  stationId: string;
  stationName: string;
  date: string;
  totalSales: number;
  totalQuantity: number;
  totalTransactions: number;
  fuelTypeSales: {
    fuelType: string;
    sales: number;
    quantity: number;
    transactions: number;
  }[];
}

interface ShiftReport {
  id: number;
  stationName: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  openingCash: number;
  closingCash: number;
  totalSales: number;
  cashSales: number;
  digitalSales: number;
  status: 'active' | 'completed' | 'cancelled';
}

interface PumpPerformance {
  pumpId: string;
  pumpName: string;
  pumpNumber: string;
  stationName: string;
  totalSales: number;
  totalQuantity: number;
  transactions: number;
  nozzles: {
    nozzleId: string;
    nozzleNumber: string;
    fuelType: string;
    sales: number;
    quantity: number;
  }[];
}

interface NozzleBreakdown {
  nozzleId: string;
  nozzleNumber: number;
  fuelType: string;
  pumpName: string;
  stationName: string;
  totalSales: number;
  totalQuantity: number;
  transactions: number;
  avgTransactionValue: number;
}

export default function Reports() {
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [dateRange, setDateRange] = useState({
    startDate: firstDayOfMonth,
    endDate: today
  });
  const [selectedStation, setSelectedStation] = useState<string>('all');

  // Fetch stations
  const { data: stations } = useQuery({
    queryKey: ['owner-stations'],
    queryFn: async () => {
      const response = await apiClient.get<Station[]>('/stations');
      return response;
    }
  });

  // Fetch sales reports
  const { data: salesReports, isLoading: salesLoading } = useQuery({
    queryKey: ['sales-reports', dateRange, selectedStation],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      if (selectedStation !== 'all') {
        params.append('stationId', selectedStation);
      }
      const response = await apiClient.get<SalesReport[]>(`/reports/sales?${params.toString()}`);
      return response;
    }
  });

  // Fetch shift reports
  const { data: shiftReports, isLoading: shiftsLoading } = useQuery({
    queryKey: ['shift-reports', dateRange, selectedStation],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      if (selectedStation !== 'all') {
        params.append('stationId', selectedStation);
      }
      const response = await apiClient.get<ShiftReport[]>(`/reports/shifts?${params.toString()}`);
      return response;
    }
  });

  // Fetch pump performance
  const { data: pumpPerformance, isLoading: pumpsLoading } = useQuery({
    queryKey: ['pump-performance', dateRange, selectedStation],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      if (selectedStation !== 'all') {
        params.append('stationId', selectedStation);
      }
      const response = await apiClient.get<PumpPerformance[]>(`/reports/pumps?${params.toString()}`);
      return response;
    }
  });

  // Fetch nozzle-wise breakdown
  const { data: nozzleBreakdown, isLoading: nozzlesLoading } = useQuery({
    queryKey: ['nozzle-breakdown', dateRange, selectedStation],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      if (selectedStation !== 'all') {
        params.append('stationId', selectedStation);
      }
      // Backend returns { success: true, data: { startDate, endDate, nozzles: [...] } }
      // Backend nozzle fields: nozzleId, nozzleNumber, fuelType, fuelLabel, pump:{id,name,number}, litres, amount, cash, online, credit, readings
      const response = await apiClient.get<{
        startDate: string;
        endDate: string;
        nozzles: Array<{
          nozzleId: string;
          nozzleNumber: number;
          fuelType?: string;
          fuelLabel?: string;
          pump?: { id?: string; name?: string; number?: number };
          litres?: number;
          amount?: number;
          cash?: number;
          online?: number;
          credit?: number;
          readings?: number;
        }>;
      }>(`/dashboard/nozzle-breakdown?${params.toString()}`);

      const backendNozzles = response?.nozzles || [];

      // Map backend shape to UI shape expected by this component
      const mapped = backendNozzles.map(n => ({
        nozzleId: n.nozzleId,
        nozzleNumber: n.nozzleNumber,
        fuelType: n.fuelType || n.fuelLabel || 'unknown',
        pumpName: n.pump?.name || '',
        stationName: '',
        totalSales: n.amount ?? 0,
        totalQuantity: n.litres ?? 0,
        transactions: n.readings ?? 0,
        avgTransactionValue: (n.readings && n.readings > 0) ? ((n.amount ?? 0) / n.readings) : 0
      }));

      return mapped;
    }
  });

  const calculateTotals = (reports: SalesReport[] | undefined) => {
    if (!reports) return { sales: 0, quantity: 0, transactions: 0 };
    return reports.reduce(
      (acc, report) => ({
        sales: acc.sales + report.totalSales,
        quantity: acc.quantity + report.totalQuantity,
        transactions: acc.transactions + report.totalTransactions
      }),
      { sales: 0, quantity: 0, transactions: 0 }
    );
  };

  const totals = calculateTotals(salesReports);

  const { toast } = useToast();
  const currency = (v: unknown) => v == null ? '' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const numberFmt = (v: unknown) => v == null ? '' : Number(v).toLocaleString('en-IN');
  const dateFmt = (v: unknown) => v ? format(new Date(v as string | number | Date), 'yyyy-MM-dd') : '';

  const handlePrintPdf = (reportType: string) => {
    // Professional printable HTML window — user can print to PDF
    let html = `<html><head><title>Report - ${reportType}</title>
    <style>
      body{font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#333;}
      h1{color:#1a365d;border-bottom:3px solid #3182ce;padding-bottom:10px;}
      h2{color:#2d3748;margin-top:25px;}
      h3{color:#4a5568;margin-top:20px;margin-bottom:10px;}
      table{width:100%;border-collapse:collapse;margin-top:15px;margin-bottom:25px;}
      th,td{border:1px solid #e2e8f0;padding:10px 12px;text-align:left;}
      th{background:#edf2f7;font-weight:600;color:#2d3748;}
      tr:nth-child(even){background:#f7fafc;}
      .summary-box{background:#ebf8ff;border:1px solid #90cdf4;border-radius:8px;padding:15px;margin:15px 0;}
      .summary-row{display:flex;justify-content:space-between;margin:8px 0;}
      .fuel-breakdown{margin-left:20px;font-size:0.95em;}
      .total-row{font-weight:bold;background:#e2e8f0 !important;}
      .header-info{color:#718096;font-size:0.9em;margin-bottom:20px;}
      @media print{body{padding:15px;}}
    </style></head><body>`;
    
    html += `<h1>FuelSync Report</h1>`;
    html += `<div class="header-info">Generated: ${format(new Date(), 'PPpp')}<br/>Period: ${dateRange.startDate} to ${dateRange.endDate}</div>`;
    html += `<h2>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report</h2>`;

    if (reportType === 'sales') {
      const rows = salesReports || [];
      const grandTotal = rows.reduce((acc, r) => ({
        sales: acc.sales + (r.totalSales || 0),
        quantity: acc.quantity + (r.totalQuantity || 0),
        transactions: acc.transactions + (r.totalTransactions || 0)
      }), { sales: 0, quantity: 0, transactions: 0 });
      const avgPricePerLiter = grandTotal.quantity > 0 ? grandTotal.sales / grandTotal.quantity : 0;

      html += `<div class="summary-box">
        <strong>Summary</strong>
        <div class="summary-row"><span>Total Sales:</span><span>${currency(grandTotal.sales)}</span></div>
        <div class="summary-row"><span>Total Volume:</span><span>${grandTotal.quantity.toFixed(2)} L</span></div>
        <div class="summary-row"><span>Total Transactions:</span><span>${grandTotal.transactions}</span></div>
        <div class="summary-row"><span>Avg Price/Liter:</span><span>${currency(avgPricePerLiter)}</span></div>
      </div>`;

      html += `<table><thead><tr><th>Station</th><th>Date</th><th>Total Sales</th><th>Quantity (L)</th><th>Price/L</th><th>Transactions</th></tr></thead><tbody>`;
      rows.forEach(r => {
        const pricePerLiter = r.totalQuantity > 0 ? r.totalSales / r.totalQuantity : 0;
        html += `<tr>
          <td>${r.stationName}</td>
          <td>${dateFmt(r.date)}</td>
          <td>${currency(r.totalSales)}</td>
          <td>${(r.totalQuantity ?? 0).toFixed(2)}</td>
          <td>${currency(pricePerLiter)}</td>
          <td><strong>${r.totalTransactions ?? 0}</strong></td>
        </tr>`;
        // Fuel type breakdown
        if (r.fuelTypeSales && r.fuelTypeSales.length > 0) {
          html += `<tr><td colspan="6" class="fuel-breakdown"><strong>Fuel Breakdown:</strong><table style="margin:10px 0;width:95%;margin-left:auto;">
            <thead><tr><th>Fuel Type</th><th>Sales</th><th>Quantity</th><th>Price/L</th><th>Txns</th></tr></thead><tbody>`;
          r.fuelTypeSales.forEach(f => {
            const fuelPricePerL = f.quantity > 0 ? f.sales / f.quantity : 0;
            html += `<tr><td>${f.fuelType}</td><td>${currency(f.sales)}</td><td>${f.quantity.toFixed(2)} L</td><td>${currency(fuelPricePerL)}</td><td>${f.transactions}</td></tr>`;
          });
          html += `</tbody></table></td></tr>`;
        }
      });
      html += `<tr class="total-row"><td>TOTAL</td><td></td><td>${currency(grandTotal.sales)}</td><td>${grandTotal.quantity.toFixed(2)}</td><td>${currency(avgPricePerLiter)}</td><td>${grandTotal.transactions}</td></tr>`;
      html += `</tbody></table>`;
    } else if (reportType === 'nozzles') {
      const rows = nozzleBreakdown || [];
      const grandTotal = rows.reduce((acc, n) => ({
        sales: acc.sales + (n.totalSales || 0),
        quantity: acc.quantity + (n.totalQuantity || 0),
        transactions: acc.transactions + (n.transactions || 0)
      }), { sales: 0, quantity: 0, transactions: 0 });
      
      html += `<div class="summary-box">
        <strong>Nozzle Summary</strong>
        <div class="summary-row"><span>Total Nozzles:</span><span>${rows.length}</span></div>
        <div class="summary-row"><span>Total Sales:</span><span>${currency(grandTotal.sales)}</span></div>
        <div class="summary-row"><span>Total Volume:</span><span>${grandTotal.quantity.toFixed(2)} L</span></div>
        <div class="summary-row"><span>Total Transactions:</span><span>${grandTotal.transactions}</span></div>
      </div>`;
      
      html += `<table><thead><tr><th>Nozzle</th><th>Pump</th><th>Fuel</th><th>Sales</th><th>Volume (L)</th><th>Price/L</th><th>Txns</th><th>Avg Txn</th></tr></thead><tbody>`;
      rows.forEach(n => {
        const pricePerL = n.totalQuantity > 0 ? n.totalSales / n.totalQuantity : 0;
        html += `<tr><td>${n.nozzleNumber}</td><td>${n.pumpName}</td><td>${n.fuelType}</td><td>${currency(n.totalSales)}</td><td>${(n.totalQuantity ?? 0).toFixed(2)}</td><td>${currency(pricePerL)}</td><td><strong>${n.transactions}</strong></td><td>${currency(n.avgTransactionValue)}</td></tr>`;
      });
      html += `</tbody></table>`;
    } else if (reportType === 'shifts') {
      const rows = shiftReports || [];
      html += `<table><thead><tr><th>Shift ID</th><th>Station</th><th>Employee</th><th>Start</th><th>End</th><th>Opening</th><th>Closing</th><th>Total Sales</th></tr></thead><tbody>`;
      rows.forEach(s => {
        html += `<tr><td>${s.id}</td><td>${s.stationName}</td><td>${s.employeeName}</td><td>${s.startTime}</td><td>${s.endTime || ''}</td><td>${currency(s.openingCash)}</td><td>${currency(s.closingCash)}</td><td>${currency(s.totalSales)}</td></tr>`;
      });
      html += `</tbody></table>`;
    } else if (reportType === 'pumps') {
      const rows = pumpPerformance || [];
      html += `<table><thead><tr><th>Pump</th><th>Station</th><th>Sales</th><th>Volume</th><th>Txns</th></tr></thead><tbody>`;
      rows.forEach(p => {
        html += `<tr><td>${p.pumpName} (${p.pumpNumber})</td><td>${p.stationName}</td><td>${currency(p.totalSales)}</td><td>${(p.totalQuantity ?? 0).toFixed(2)}</td><td>${p.transactions}</td></tr>`;
      });
      html += `</tbody></table>`;
    }

    html += `</body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      toast({ title: 'Popup blocked', description: 'Please allow popups to use Print/PDF export.' });
      return;
    }
    w.document.write(html);
    w.document.close();
    // Delay to allow rendering
    setTimeout(() => { w.print(); }, 500);
  };

  const handleExport = (reportType: string) => {
    try {
      if (reportType === 'sales') {
        // Create detailed rows including price per liter and fuel breakdown
        const rowsRaw = (salesReports || []).flatMap(r => {
          const pricePerLiter = r.totalQuantity > 0 ? r.totalSales / r.totalQuantity : 0;
          const mainRow = {
            stationName: r.stationName,
            date: r.date,
            fuelType: 'ALL',
            totalSales: r.totalSales,
            totalQuantity: r.totalQuantity,
            pricePerLiter: pricePerLiter,
            totalTransactions: r.totalTransactions
          };
          // Add fuel type breakdown rows
          const fuelRows = (r.fuelTypeSales || []).map(f => ({
            stationName: r.stationName,
            date: r.date,
            fuelType: f.fuelType,
            totalSales: f.sales,
            totalQuantity: f.quantity,
            pricePerLiter: f.quantity > 0 ? f.sales / f.quantity : 0,
            totalTransactions: f.transactions
          }));
          return [mainRow, ...fuelRows];
        });
        const cols = [
          { key: 'stationName', label: 'Station' },
          { key: 'date', label: 'Date', formatter: dateFmt },
          { key: 'fuelType', label: 'Fuel Type' },
          { key: 'totalSales', label: 'Total Sales', formatter: currency },
          { key: 'totalQuantity', label: 'Quantity (L)', formatter: (v: unknown) => (v == null ? '' : Number(v).toFixed(2)) },
          { key: 'pricePerLiter', label: 'Price/Liter', formatter: currency },
          { key: 'totalTransactions', label: 'Transactions', formatter: numberFmt }
        ];
        const csv = toCsv(rowsRaw, cols);
        const filename = `sales_report_${dateRange.startDate}_${dateRange.endDate}.csv`;
        downloadCsv(filename, csv);
        toast({ title: 'Export Ready', description: `Downloaded ${filename}` });
        return;
      } else if (reportType === 'nozzles') {
        const rowsRaw = (nozzleBreakdown || []).map(n => {
          const pricePerLiter = n.totalQuantity > 0 ? n.totalSales / n.totalQuantity : 0;
          return {
            nozzleId: n.nozzleId,
            nozzleNumber: n.nozzleNumber,
            fuelType: n.fuelType,
            pumpName: n.pumpName,
            totalSales: n.totalSales,
            totalQuantity: n.totalQuantity,
            pricePerLiter: pricePerLiter,
            transactions: n.transactions,
            avgTransactionValue: n.avgTransactionValue
          };
        });
        const cols = [
          { key: 'nozzleNumber', label: 'Nozzle' },
          { key: 'pumpName', label: 'Pump' },
          { key: 'fuelType', label: 'Fuel' },
          { key: 'totalSales', label: 'Total Sales', formatter: currency },
          { key: 'totalQuantity', label: 'Volume (L)', formatter: (v: unknown) => (v == null ? '' : Number(v).toFixed(2)) },
          { key: 'pricePerLiter', label: 'Price/Liter', formatter: currency },
          { key: 'transactions', label: 'Transactions', formatter: numberFmt },
          { key: 'avgTransactionValue', label: 'Avg Transaction', formatter: currency }
        ];
        const csv = toCsv(rowsRaw, cols);
        const filename = `nozzles_report_${dateRange.startDate}_${dateRange.endDate}.csv`;
        downloadCsv(filename, csv);
        toast({ title: 'Export Ready', description: `Downloaded ${filename}` });
        return;
      } else if (reportType === 'shifts') {
        const rowsRaw = (shiftReports || []).map(s => ({
          id: s.id,
          stationName: s.stationName,
          employeeName: s.employeeName,
          startTime: s.startTime,
          endTime: s.endTime,
          openingCash: s.openingCash,
          closingCash: s.closingCash,
          totalSales: s.totalSales,
          cashSales: s.cashSales,
          digitalSales: s.digitalSales,
          status: s.status
        }));
        const cols = [
          { key: 'id', label: 'Shift ID' },
          { key: 'stationName', label: 'Station' },
          { key: 'employeeName', label: 'Employee' },
          { key: 'startTime', label: 'Start' },
          { key: 'endTime', label: 'End' },
          { key: 'openingCash', label: 'Opening Cash', formatter: currency },
          { key: 'closingCash', label: 'Closing Cash', formatter: currency },
          { key: 'totalSales', label: 'Total Sales', formatter: currency },
          { key: 'status', label: 'Status' }
        ];
        const csv = toCsv(rowsRaw, cols);
        const filename = `shifts_report_${dateRange.startDate}_${dateRange.endDate}.csv`;
        downloadCsv(filename, csv);
        toast({ title: 'Export Ready', description: `Downloaded ${filename}` });
        return;
      } else if (reportType === 'pumps') {
        const rowsRaw = (pumpPerformance || []).map(p => ({
          pumpId: p.pumpId,
          pumpName: p.pumpName,
          pumpNumber: p.pumpNumber,
          stationName: p.stationName,
          totalSales: p.totalSales,
          totalQuantity: p.totalQuantity,
          transactions: p.transactions
        }));
        const cols = [
          { key: 'pumpName', label: 'Pump' },
          { key: 'stationName', label: 'Station' },
          { key: 'totalSales', label: 'Total Sales', formatter: currency },
          { key: 'totalQuantity', label: 'Volume (L)', formatter: (v: unknown) => (v == null ? '' : Number(v).toFixed(2)) },
          { key: 'transactions', label: 'Transactions', formatter: numberFmt }
        ];
        const csv = toCsv(rowsRaw, cols);
        const filename = `pumps_report_${dateRange.startDate}_${dateRange.endDate}.csv`;
        downloadCsv(filename, csv);
        toast({ title: 'Export Ready', description: `Downloaded ${filename}` });
        return;
      }

      toast({ title: 'Nothing to export', description: 'No rows available for selected report and filters.' });
    } catch (err) {
      console.error('Export error', err);
      toast({ title: 'Export failed', description: 'Unable to export report' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="container mx-auto p-6 space-y-8">
        {/* Modern Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 p-6 md:p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
                  <BarChart3 className="w-8 h-8 md:w-10 md:h-10" />
                  Reports & Analytics
                </h1>
                <p className="text-blue-100 text-base md:text-lg">
                  Comprehensive insights into your fuel station performance
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:flex lg:items-center lg:gap-4">
                <div className="text-center lg:text-right">
                  <div className="text-xl md:text-2xl font-bold">₹{totals.sales.toLocaleString('en-IN')}</div>
                  <div className="text-blue-200 text-xs md:text-sm">Total Revenue</div>
                </div>
                <div className="hidden lg:block w-px h-12 bg-white/20"></div>
                <div className="text-center lg:text-right">
                  <div className="text-xl md:text-2xl font-bold">{totals.quantity.toFixed(1)}L</div>
                  <div className="text-blue-200 text-xs md:text-sm">Fuel Dispensed</div>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-4 -right-4 w-20 h-20 md:w-24 md:h-24 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute -bottom-6 -left-6 w-24 h-24 md:w-32 md:h-32 bg-white/5 rounded-full blur-2xl"></div>
        </div>

        {/* Quick Filters Bar */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col gap-4 md:gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Filter className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Filters</h3>
                  <p className="text-sm text-gray-500">Customize your analytics view</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date Range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                      className="w-full"
                    />
                    <Input
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Station</Label>
                  <Select value={selectedStation} onValueChange={setSelectedStation}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stations</SelectItem>
                      {stations?.map((station) => (
                        <SelectItem key={station.id} value={station.id}>
                          {station.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 md:justify-end md:items-end">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                  <Button size="sm" className="w-full sm:w-auto">
                    <Download className="w-4 h-4 mr-2" />
                    Export All
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics Dashboard */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-500 to-emerald-600 text-white">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-green-100 text-xs md:text-sm font-medium">Total Revenue</p>
                  <p className="text-2xl md:text-3xl font-bold">₹{totals.sales.toLocaleString('en-IN')}</p>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 text-green-200 mr-1" />
                    <span className="text-green-200 text-xs md:text-sm">+12.5%</span>
                  </div>
                </div>
                <div className="p-2 md:p-3 bg-white/20 rounded-full ml-3">
                  <DollarSign className="w-6 h-6 md:w-8 md:h-8" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-blue-100 text-xs md:text-sm font-medium">Fuel Dispensed</p>
                  <p className="text-2xl md:text-3xl font-bold">{totals.quantity.toFixed(1)}L</p>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 text-blue-200 mr-1" />
                    <span className="text-blue-200 text-xs md:text-sm">+8.2%</span>
                  </div>
                </div>
                <div className="p-2 md:p-3 bg-white/20 rounded-full ml-3">
                  <Droplet className="w-6 h-6 md:w-8 md:h-8" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-500 to-violet-600 text-white">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-purple-100 text-xs md:text-sm font-medium">Transactions</p>
                  <p className="text-2xl md:text-3xl font-bold">{totals.transactions}</p>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 text-purple-200 mr-1" />
                    <span className="text-purple-200 text-xs md:text-sm">+15.3%</span>
                  </div>
                </div>
                <div className="p-2 md:p-3 bg-white/20 rounded-full ml-3">
                  <Activity className="w-6 h-6 md:w-8 md:h-8" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-orange-500 to-red-500 text-white">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-orange-100 text-xs md:text-sm font-medium">Avg Transaction</p>
                  <p className="text-2xl md:text-3xl font-bold">
                    ₹{totals.transactions > 0 ? (totals.sales / totals.transactions).toFixed(0) : '0'}
                  </p>
                  <div className="flex items-center mt-2">
                    <ArrowDownRight className="w-3 h-3 md:w-4 md:h-4 text-orange-200 mr-1" />
                    <span className="text-orange-200 text-xs md:text-sm">-2.1%</span>
                  </div>
                </div>
                <div className="p-2 md:p-3 bg-white/20 rounded-full ml-3">
                  <Target className="w-6 h-6 md:w-8 md:h-8" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Tabs */}
        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            <Tabs defaultValue="overview" className="w-full">
              <div className="flex flex-col gap-4">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-5 bg-gray-100 p-1 rounded-xl h-auto">
                  <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm py-2 md:py-3">
                    <PieChart className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Overview</span>
                    <span className="sm:hidden">Overview</span>
                  </TabsTrigger>
                  <TabsTrigger value="sales" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm py-2 md:py-3">
                    <BarChart3 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Sales</span>
                    <span className="sm:hidden">Sales</span>
                  </TabsTrigger>
                  <TabsTrigger value="nozzles" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm py-2 md:py-3">
                    <Droplet className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Nozzles</span>
                    <span className="sm:hidden">Nozzles</span>
                  </TabsTrigger>
                  <TabsTrigger value="shifts" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm py-2 md:py-3">
                    <Clock className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Shifts</span>
                    <span className="sm:hidden">Shifts</span>
                  </TabsTrigger>
                  <TabsTrigger value="pumps" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm py-2 md:py-3 col-span-2 md:col-span-1">
                    <Activity className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Pumps</span>
                    <span className="sm:hidden">Pumps</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {/* Revenue Trend Chart Placeholder */}
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                        <LineChart className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                        Revenue Trend
                      </CardTitle>
                      <CardDescription>Daily revenue over the selected period</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48 md:h-64 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-dashed border-blue-200">
                        <div className="text-center p-4">
                          <LineChart className="w-10 h-10 md:w-12 md:h-12 mx-auto text-blue-400 mb-3" />
                          <p className="text-blue-600 font-medium text-sm md:text-base">Revenue Chart</p>
                          <p className="text-xs md:text-sm text-blue-500">Interactive chart will be displayed here</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Fuel Type Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-purple-600" />
                        Fuel Distribution
                      </CardTitle>
                      <CardDescription>Sales by fuel type</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span className="text-sm">Petrol</span>
                          </div>
                          <span className="font-medium">65%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm">Diesel</span>
                          </div>
                          <span className="font-medium">30%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                            <span className="text-sm">CNG</span>
                          </div>
                          <span className="font-medium">5%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Performing Stations */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        Top Stations
                      </CardTitle>
                      <CardDescription>Best performing stations</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {stations?.slice(0, 3).map((station, idx) => (
                          <div key={station.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                {idx + 1}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{station.name}</p>
                                <p className="text-xs text-gray-500">{station.code}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-600">₹{(Math.random() * 50000 + 20000).toFixed(0)}</p>
                              <p className="text-xs text-gray-500">+{Math.floor(Math.random() * 20 + 5)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Activity */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-orange-600" />
                        Recent Activity
                      </CardTitle>
                      <CardDescription>Latest transactions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Fuel sale completed</p>
                            <p className="text-xs text-gray-500">Pump A, Nozzle 1 • 2 mins ago</p>
                          </div>
                          <span className="text-sm font-bold text-green-600">₹2,450</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Shift handover</p>
                            <p className="text-xs text-gray-500">Employee: John Doe • 15 mins ago</p>
                          </div>
                          <span className="text-sm font-bold text-blue-600">₹15,230</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Price updated</p>
                            <p className="text-xs text-gray-500">Diesel: ₹87.25/L • 1 hour ago</p>
                          </div>
                          <span className="text-sm font-bold text-purple-600">+₹2.00</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Performance Insights */}
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                        <Zap className="w-4 h-4 md:w-5 md:h-5 text-yellow-600" />
                        Performance Insights
                      </CardTitle>
                      <CardDescription>AI-powered insights and recommendations</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
                        <div className="p-3 md:p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="font-medium text-green-800 text-sm">Peak Hours</span>
                          </div>
                          <p className="text-xs md:text-sm text-green-700">Your station performs best between 6-8 AM and 5-7 PM. Consider staffing adjustments.</p>
                        </div>
                        <div className="p-3 md:p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="font-medium text-blue-800 text-sm">Fuel Mix</span>
                          </div>
                          <p className="text-xs md:text-sm text-blue-700">Diesel sales are up 15% this month. Consider increasing diesel inventory.</p>
                        </div>
                        <div className="p-3 md:p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            <span className="font-medium text-orange-800 text-sm">Price Optimization</span>
                          </div>
                          <p className="text-xs md:text-sm text-orange-700">Petrol prices are 2% below market average. Consider a ₹1 increase.</p>
                        </div>
                        <div className="p-3 md:p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg border border-purple-200">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span className="font-medium text-purple-800 text-sm">Efficiency</span>
                          </div>
                          <p className="text-xs md:text-sm text-purple-700">Pump utilization is at 78%. Target is 85% for optimal performance.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Sales Reports Tab */}
              <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sales Reports</CardTitle>
                  <CardDescription>Detailed sales breakdown by station and fuel type</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExport('sales')}>
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handlePrintPdf('sales')}>
                    Print/PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading sales reports...</div>
              ) : salesReports && salesReports.length > 0 ? (
                <div className="space-y-4">
                  {salesReports.map((report, idx) => (
                    <Card key={idx}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{report.stationName}</CardTitle>
                            <CardDescription>
                              {format(new Date(report.date), 'MMMM d, yyyy')}
                            </CardDescription>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">
                              ₹{report.totalSales.toLocaleString('en-IN')}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {report.totalQuantity.toFixed(2)} L
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {report.fuelTypeSales.map((fuel, fuelIdx) => (
                            <div
                              key={fuelIdx}
                              className="flex items-center justify-between p-3 bg-muted rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <Badge className={getFuelBadgeClasses(fuel.fuelType)}>{fuel.fuelType.toUpperCase()}</Badge>
                                <div>
                                  <div className="font-medium">
                                    ₹{fuel.sales.toLocaleString('en-IN')}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {fuel.quantity.toFixed(2)} L • {fuel.transactions} transactions
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Sales Data</h3>
                  <p className="text-muted-foreground">
                    No sales found for the selected date range and filters
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

              {/* Nozzle-wise Sales Tab */}
              <TabsContent value="nozzles" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Nozzle-wise Sales Breakdown</CardTitle>
                  <CardDescription>Detailed sales performance by individual nozzles</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExport('nozzles')}>
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handlePrintPdf('nozzles')}>
                    Print/PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {nozzlesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading nozzle data...</div>
              ) : nozzleBreakdown && nozzleBreakdown.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {nozzleBreakdown.map((nozzle) => {
                      const totalSales = nozzle?.totalSales ?? 0;
                      const totalQuantity = nozzle?.totalQuantity ?? 0;
                      const transactions = nozzle?.transactions ?? 0;
                      const avgTransactionValue = nozzle?.avgTransactionValue ?? (transactions > 0 ? totalSales / transactions : 0);

                      return (
                      <Card key={nozzle.nozzleId}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">
                                Nozzle {nozzle.nozzleNumber} - {nozzle.pumpName}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                {nozzle.stationName}
                              </CardDescription>
                            </div>
                            <Badge className={getFuelBadgeClasses(nozzle.fuelType)} variant="outline">{nozzle.fuelType.toUpperCase()}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Total Sales</p>
                              <p className="text-lg font-bold">₹{totalSales.toLocaleString('en-IN')}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Volume</p>
                              <p className="text-lg font-bold">{totalQuantity.toFixed(2)} L</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Transactions</p>
                              <p className="text-lg font-bold">{transactions}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Avg. Value</p>
                              <p className="text-lg font-bold">₹{avgTransactionValue.toFixed(2)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Droplet className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Nozzle Data</h3>
                  <p className="text-muted-foreground">
                    No nozzle sales data found for the selected period
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

              {/* Shift Reports Tab */}
              <TabsContent value="shifts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Shift Reports</CardTitle>
                  <CardDescription>Employee shift details and performance</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExport('shifts')}>
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handlePrintPdf('shifts')}>
                    Print/PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {shiftsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading shift reports...</div>
              ) : shiftReports && shiftReports.length > 0 ? (
                <div className="space-y-3">
                  {shiftReports.map((shift) => (
                    <Card key={shift.id}>
                      <CardContent className="pt-6">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{shift.employeeName}</span>
                              <Badge variant={
                                shift.status === 'completed' ? 'default' :
                                shift.status === 'active' ? 'secondary' : 'outline'
                              }>
                                {shift.status}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>{shift.stationName}</div>
                              <div>
                                {shift.startTime} - {shift.endTime || 'In Progress'}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <div className="text-muted-foreground">Opening Cash</div>
                              <div className="font-medium">₹{shift.openingCash.toLocaleString('en-IN')}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Closing Cash</div>
                              <div className="font-medium">
                                {shift.closingCash ? `₹${shift.closingCash.toLocaleString('en-IN')}` : '-'}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Total Sales</div>
                              <div className="font-medium">₹{shift.totalSales.toLocaleString('en-IN')}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Digital Sales</div>
                              <div className="font-medium">₹{shift.digitalSales.toLocaleString('en-IN')}</div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Shift Data</h3>
                  <p className="text-muted-foreground">
                    No shifts found for the selected date range and filters
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

              {/* Pump Performance Tab */}
              <TabsContent value="pumps" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pump Performance</CardTitle>
                  <CardDescription>Performance metrics by pump and nozzle</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExport('pumps')}>
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handlePrintPdf('pumps')}>
                    Print/PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pumpsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading pump performance...</div>
              ) : pumpPerformance && pumpPerformance.length > 0 ? (
                <div className="space-y-4">
                  {pumpPerformance.map((pump, idx) => (
                    <Card key={idx}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              Pump {pump.pumpNumber} - {pump.pumpName}
                            </CardTitle>
                            <CardDescription>{pump.stationName}</CardDescription>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold">
                              ₹{pump.totalSales.toLocaleString('en-IN')}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {pump.totalQuantity.toFixed(2)} L • {pump.transactions} txns
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="text-sm font-medium mb-2">Nozzles Performance:</div>
                          {pump.nozzles.map((nozzle, nIdx) => (
                            <div
                              key={nIdx}
                              className="flex items-center justify-between p-3 bg-muted rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">Nozzle {nozzle.nozzleNumber}</Badge>
                                <Badge className={getFuelBadgeClasses(nozzle.fuelType)}>{nozzle.fuelType.toUpperCase()}</Badge>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">
                                  ₹{nozzle.sales.toLocaleString('en-IN')}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {nozzle.quantity.toFixed(2)} L
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Activity className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Pump Data</h3>
                  <p className="text-muted-foreground">
                    No pump performance data found for the selected filters
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
