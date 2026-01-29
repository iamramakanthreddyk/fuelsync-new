import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar
} from 'recharts';
import { useReports, ReportType } from '@/hooks/useReports';
import { toCsv, downloadCsv } from '@/lib/csv';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { safeToFixed } from '@/lib/format-utils';
import { useStations } from '@/hooks/api';
// charts are not used in this page yet

// Types for table columns
interface TableColumn {
  key: string;
  label: string;
  render?: (value: any, row: any) => string;
}

// Helper function to export CSV with proper formatting
const exportToCsv = (data: any[], reportType: ReportType, startDate: string, endDate: string, toast: any) => {
  if (!data || data.length === 0) {
    toast({ title: 'Nothing to export', description: 'No report data available for the selected range.' });
    return;
  }

  try {
    toast({ title: 'Export Started', description: 'Preparing CSV download...' });
    
    let csvData = data;
    const filename = `report_${reportType}_${startDate}_${endDate}.csv`;

    // Transform data based on report type for better CSV export
    if (reportType === 'sales') {
      csvData = data.map(row => ({
        Date: row.date || '',
        'Total Sales': `₹${(row.totalSales ?? 0).toLocaleString('en-IN')}`,
        'Total Quantity': `${(row.totalQuantity ?? 0).toLocaleString('en-IN')} L`,
        Transactions: row.totalTransactions ?? 0
      }));
    } else if (reportType === 'daily-sales') {
      csvData = data.map(row => ({
        Date: row.date || '',
        'Total Sale Value': `₹${(row.totalSaleValue ?? 0).toLocaleString('en-IN')}`,
        'Total Liters': `${(row.totalLiters ?? 0).toLocaleString('en-IN')} L`,
        'Fuel Type': row.fuelType || ''
      }));
    } else if (reportType === 'sample-readings') {
      csvData = data.map(row => ({
        Date: row.readingDate || '',
        Pump: row.pumpName || row.pump || '',
        Nozzle: row.nozzleNumber || row.nozzle || '',
        'Opening Reading': `${(row.openingReading ?? 0).toLocaleString('en-IN')} L`,
        'Closing Reading': `${(row.closingReading ?? 0).toLocaleString('en-IN')} L`,
        'Fuel Type': row.fuelType || ''
      }));
    } else if (reportType === 'sample-statistics') {
      csvData = data.map(row => ({
        'Fuel Type': row.fuelType || '',
        'Total Sales': `₹${(row.totalSales ?? 0).toLocaleString('en-IN')}`,
        'Total Quantity': `${(row.totalQuantity ?? 0).toLocaleString('en-IN')} L`,
        'Average Price': `₹${(row.averagePrice ?? 0).toLocaleString('en-IN')}`,
        Transactions: row.totalTransactions ?? 0
      }));
    }

    const csv = toCsv(csvData);
    downloadCsv(filename, csv);
    toast({ title: 'Export Ready', description: `Downloaded ${filename}` });
  } catch (err) {
    console.error('Export error', err);
    toast({ title: 'Export failed', description: 'Unable to generate CSV' });
  }
};

// Generic table component
const DataTable: React.FC<{ columns: TableColumn[], data: any[] }> = ({ columns, data }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          {columns.map(col => (
            <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((row, index) => (
          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            {columns.map(col => (
              <td key={col.key} className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 sm:px-6">
                {col.render ? col.render(row[col.key], row) : (row[col.key] ?? 'N/A')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Summary cards component
const SummaryCards: React.FC<{ data: any[], reportType: ReportType }> = ({ data, reportType }) => {
  const summary = useMemo(() => {
    if (!data || data.length === 0) return null;

    if (reportType === 'sales') {
      const totalSales = data.reduce((sum, row) => sum + (row.totalSales ?? 0), 0);
      const totalQuantity = data.reduce((sum, row) => sum + (row.totalQuantity ?? 0), 0);
      const totalTransactions = data.reduce((sum, row) => sum + (row.totalTransactions ?? 0), 0);
      return { totalSales, totalQuantity, totalTransactions };
    } else if (reportType === 'daily-sales') {
      const totalSales = data.reduce((sum, row) => sum + (row.totalSaleValue ?? 0), 0);
      const totalLiters = data.reduce((sum, row) => sum + (row.totalLiters ?? 0), 0);
      return { totalSales, totalLiters };
    } else if (reportType === 'sample-statistics') {
      const totalSales = data.reduce((sum, row) => sum + (row.totalSales ?? 0), 0);
      const totalQuantity = data.reduce((sum, row) => sum + (row.totalQuantity ?? 0), 0);
      const avgPrice = totalSales / totalQuantity || 0;
      return { totalSales, totalQuantity, avgPrice };
    }
    return null;
  }, [data, reportType]);

  if (!summary) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {reportType === 'sales' && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">₹{summary.totalSales.toLocaleString('en-IN')}</div>
              <p className="text-sm text-muted-foreground">Total Sales</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{summary.totalQuantity.toLocaleString('en-IN')} L</div>
              <p className="text-sm text-muted-foreground">Total Quantity</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">{summary.totalTransactions}</div>
              <p className="text-sm text-muted-foreground">Transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">₹{(summary.totalSales / summary.totalQuantity || 0).toFixed(2)}</div>
              <p className="text-sm text-muted-foreground">Avg Price/L</p>
            </CardContent>
          </Card>
        </>
      )}
      {reportType === 'daily-sales' && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">₹{summary.totalSales.toLocaleString('en-IN')}</div>
              <p className="text-sm text-muted-foreground">Total Sales</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{summary.totalLiters.toLocaleString('en-IN')} L</div>
              <p className="text-sm text-muted-foreground">Total Liters</p>
            </CardContent>
          </Card>
        </>
      )}
      {reportType === 'sample-statistics' && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">₹{summary.totalSales.toLocaleString('en-IN')}</div>
              <p className="text-sm text-muted-foreground">Total Sales</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{summary.totalQuantity.toLocaleString('en-IN')} L</div>
              <p className="text-sm text-muted-foreground">Total Quantity</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">₹{(((summary as any)?.avgPrice) ?? 0).toFixed(2)}</div>
              <p className="text-sm text-muted-foreground">Avg Price</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default function Reports() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [fuelTypeFilter, setFuelTypeFilter] = useState<string>('all');
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch stations
  const { data: stationsResponse } = useStations();
  const stations = stationsResponse?.data;

  // Set default station when stations load
  useEffect(() => {
    if (stations && stations.length > 0 && !selectedStation) {
      setSelectedStation(stations[0].id);
    }
  }, [stations, selectedStation]);

  // Determine current station based on selection
  const currentStation = !selectedStation || selectedStation === 'all' 
    ? stations?.[0] 
    : stations?.find(s => s.id === selectedStation);

  // Use central hook for reports
  const { data: reportResponse, isLoading } = useReports(currentStation?.id, startDate, endDate, reportType as ReportType, !!currentStation);
  const reportData: { data: any[] } = (reportResponse as any) ?? { data: [] };

  // Filter data based on fuel type if applicable
  const filteredData = useMemo(() => {
    if (!reportData.data || fuelTypeFilter === 'all') return reportData.data;
    return reportData.data.filter((row: any) => row.fuelType === fuelTypeFilter);
  }, [reportData.data, fuelTypeFilter]);

  // Get unique fuel types for filter
  const fuelTypes = useMemo(() => {
    if (!reportData.data) return [];
    const types = new Set(reportData.data.map((row: any) => row.fuelType).filter(Boolean));
    return Array.from(types);
  }, [reportData.data]);

  const handleExport = () => exportToCsv(filteredData, reportType, startDate, endDate, toast);

  return (
    <div className="space-y-6">
      <div className="px-4 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Generate detailed reports and view analytics for your fuel station.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
          <CardDescription>
            Select date range and report type to generate custom reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="sm:col-span-1">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="sm:col-span-1">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="sm:col-span-1">
              <Label htmlFor="station">Station</Label>
              <Select value={selectedStation || 'all'} onValueChange={(value) => setSelectedStation(value === 'all' ? '' : value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a station" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stations</SelectItem>
                  {(Array.isArray(stations) ? stations : []).map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-1">
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales Report</SelectItem>
                  <SelectItem value="daily-sales">Daily Sales Summary</SelectItem>
                  <SelectItem value="sample-readings">Sample Readings</SelectItem>
                  <SelectItem value="sample-statistics">Sample Statistics</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(reportType === 'daily-sales' || reportType === 'sample-statistics') && fuelTypes.length > 0 && (
              <div className="sm:col-span-1">
                <Label htmlFor="fuelType">Fuel Type</Label>
                <Select value={fuelTypeFilter} onValueChange={setFuelTypeFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {fuelTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end sm:col-span-1">
              <Button onClick={handleExport} className="w-full">
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {!isLoading && filteredData && filteredData.length > 0 && (
        <SummaryCards data={filteredData} reportType={reportType} />
      )}

      <div className="text-center px-4">
        <span className="text-3xl sm:text-4xl">📊</span>
        <p className="text-muted-foreground">Reports preview</p>
        <p className="text-sm text-muted-foreground">Preview of generated report rows</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Quick view of the generated report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
            <div />
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCsv(filteredData, reportType, startDate, endDate, toast)}
                className="flex-1 sm:flex-none"
              >
                Export CSV
              </Button>
            </div>
          </div>

          {/* Charts */}
          {reportType === 'sales' && filteredData && Array.isArray(filteredData) && filteredData.length > 0 && (
            (() => {
              const mapped = filteredData
                .map(r => ({
                  date: r.date || '',
                  sales: r.totalSales ?? 0,
                  quantity: r.totalQuantity ?? 0,
                  transactions: r.totalTransactions ?? 0
                }))
                .filter(d => d.date)
                .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

              return (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Sales Trend</h3>
                  <div style={{ width: '100%', height: 300 }} className="mb-4">
                    <ResponsiveContainer>
                      <AreaChart data={mapped} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `₹${safeToFixed(v / 1000, 0)}K`} />
                        <Tooltip formatter={(v: unknown) => typeof v === 'number' ? [`₹${v.toLocaleString('en-IN')}`, 'Sales'] : [String(v), 'Sales']} />
                        <Area type="monotone" dataKey="sales" stroke="#3b82f6" fill="url(#colorSales)" name="Sales" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()
          )}

          {reportType === 'daily-sales' && filteredData && Array.isArray(filteredData) && filteredData.length > 0 && (
            (() => {
              const mapped = filteredData
                .map(r => ({
                  date: r.date || '',
                  sales: r.totalSaleValue ?? 0,
                  liters: r.totalLiters ?? 0
                }))
                .filter(d => d.date)
                .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

              return (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Daily Sales & Volume</h3>
                  <div style={{ width: '100%', height: 300 }} className="mb-4">
                    <ResponsiveContainer>
                      <LineChart data={mapped} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="sales" orientation="left" tickFormatter={(v) => `₹${safeToFixed(v / 1000, 0)}K`} />
                        <YAxis yAxisId="liters" orientation="right" tickFormatter={(v) => `${safeToFixed(v, 0)}L`} />
                        <Tooltip
                          formatter={(v: unknown, name: string) => {
                            if (name === 'Sales') return [`₹${Number(v).toLocaleString('en-IN')}`, name];
                            if (name === 'Liters') return [`${Number(v).toLocaleString('en-IN')}L`, name];
                            return [String(v), name];
                          }}
                        />
                        <Line yAxisId="sales" type="monotone" dataKey="sales" stroke="#3b82f6" name="Sales" />
                        <Line yAxisId="liters" type="monotone" dataKey="liters" stroke="#10b981" name="Liters" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()
          )}

          {reportType === 'sample-statistics' && filteredData && Array.isArray(filteredData) && filteredData.length > 0 && (
            (() => {
              const mapped = filteredData.map(r => ({
                fuelType: r.fuelType || 'Unknown',
                sales: r.totalSales ?? 0,
                quantity: r.totalQuantity ?? 0
              }));

              return (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Fuel Type Performance</h3>
                  <div style={{ width: '100%', height: 300 }} className="mb-4">
                    <ResponsiveContainer>
                      <BarChart data={mapped} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fuelType" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `₹${safeToFixed(v / 1000, 0)}K`} />
                        <Tooltip formatter={(v: unknown) => typeof v === 'number' ? [`₹${v.toLocaleString('en-IN')}`, 'Sales'] : [String(v), 'Sales']} />
                        <Bar dataKey="sales" fill="#3b82f6" name="Sales" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()
          )}

          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading report...</div>
          ) : !filteredData || !Array.isArray(filteredData) || filteredData.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {!Array.isArray(filteredData) ? 'Error loading report data' : 'No data for selected range and filters'}
            </div>
          ) : (
            <>
              {/* Tables */}
              {reportType === 'sales' && (
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date' },
                    { key: 'totalSales', label: 'Total Sales', render: (v) => `₹${(v ?? 0).toLocaleString('en-IN')}` },
                    { key: 'totalQuantity', label: 'Total Quantity', render: (v) => `${(v ?? 0).toLocaleString('en-IN')} L` },
                    { key: 'totalTransactions', label: 'Transactions' }
                  ]}
                  data={filteredData}
                />
              )}

              {reportType === 'daily-sales' && (
                <DataTable
                  columns={[
                    { key: 'date', label: 'Date' },
                    { key: 'totalSaleValue', label: 'Total Sale Value', render: (v) => `₹${(v ?? 0).toLocaleString('en-IN')}` },
                    { key: 'totalLiters', label: 'Total Liters', render: (v) => `${(v ?? 0).toLocaleString('en-IN')} L` },
                    { key: 'fuelType', label: 'Fuel Type' }
                  ]}
                  data={filteredData}
                />
              )}

              {reportType === 'sample-readings' && (
                <DataTable
                  columns={[
                    { key: 'readingDate', label: 'Date' },
                    { key: 'pumpName', label: 'Pump', render: (v, row) => v || row.pump || 'N/A' },
                    { key: 'nozzleNumber', label: 'Nozzle', render: (v, row) => v || row.nozzle || 'N/A' },
                    { key: 'openingReading', label: 'Opening Reading', render: (v) => `${(v ?? 0).toLocaleString('en-IN')} L` },
                    { key: 'closingReading', label: 'Closing Reading', render: (v) => `${(v ?? 0).toLocaleString('en-IN')} L` },
                    { key: 'fuelType', label: 'Fuel Type' }
                  ]}
                  data={filteredData}
                />
              )}

              {reportType === 'sample-statistics' && (
                <DataTable
                  columns={[
                    { key: 'fuelType', label: 'Fuel Type' },
                    { key: 'totalSales', label: 'Total Sales', render: (v) => `₹${(v ?? 0).toLocaleString('en-IN')}` },
                    { key: 'totalQuantity', label: 'Total Quantity', render: (v) => `${(v ?? 0).toLocaleString('en-IN')} L` },
                    { key: 'averagePrice', label: 'Average Price', render: (v) => `₹${(v ?? 0).toLocaleString('en-IN')}` },
                    { key: 'totalTransactions', label: 'Transactions' }
                  ]}
                  data={filteredData}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
