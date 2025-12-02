/**
 * Owner Reports & Analytics
 * View and analyze sales, shift, and operational reports
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
  Clock
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
  const currency = (v: any) => v == null ? '' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const numberFmt = (v: any) => v == null ? '' : Number(v).toLocaleString('en-IN');
  const dateFmt = (v: any) => v ? format(new Date(v), 'yyyy-MM-dd') : '';

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
          { key: 'totalQuantity', label: 'Quantity (L)', formatter: (v: any) => (v == null ? '' : Number(v).toFixed(2)) },
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
          { key: 'totalQuantity', label: 'Volume (L)', formatter: (v: any) => (v == null ? '' : Number(v).toFixed(2)) },
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
          { key: 'totalQuantity', label: 'Volume (L)', formatter: (v: any) => (v == null ? '' : Number(v).toFixed(2)) },
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">
          View detailed reports and analyze performance across all stations
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <CardTitle>Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="station">Station</Label>
              <Select value={selectedStation} onValueChange={setSelectedStation}>
                <SelectTrigger>
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
            <div className="flex items-end">
              <Button variant="outline" className="w-full">
                <Calendar className="w-4 h-4 mr-2" />
                Quick Ranges
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totals.sales.toLocaleString('en-IN')}</div>
            <p className="text-xs text-muted-foreground">
              From {format(new Date(dateRange.startDate), 'MMM d')} to{' '}
              {format(new Date(dateRange.endDate), 'MMM d')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
            <Droplet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.quantity.toFixed(2)} L</div>
            <p className="text-xs text-muted-foreground">Fuel dispensed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.transactions}</div>
            <p className="text-xs text-muted-foreground">Total transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Reports Tabs */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">
            <BarChart3 className="w-4 h-4 mr-2" />
            Sales Reports
          </TabsTrigger>
          <TabsTrigger value="nozzles">
            <Droplet className="w-4 h-4 mr-2" />
            Nozzle-wise Sales
          </TabsTrigger>
          <TabsTrigger value="shifts">
            <Clock className="w-4 h-4 mr-2" />
            Shift Reports
          </TabsTrigger>
          <TabsTrigger value="pumps">
            <Activity className="w-4 h-4 mr-2" />
            Pump Performance
          </TabsTrigger>
        </TabsList>

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
                                <Badge>{fuel.fuelType.toUpperCase()}</Badge>
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
                            <Badge variant="outline">{nozzle.fuelType.toUpperCase()}</Badge>
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
                                <Badge>{nozzle.fuelType.toUpperCase()}</Badge>
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
  );
}
