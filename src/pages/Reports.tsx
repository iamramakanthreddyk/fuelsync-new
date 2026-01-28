import React, { useState, useEffect } from 'react';
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
  Tooltip
} from 'recharts';
import { useReports, ReportType } from '@/hooks/useReports';
import { toCsv, downloadCsv } from '@/lib/csv';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { safeToFixed } from '@/lib/format-utils';
import { useStations } from '@/hooks/api';
// charts are not used in this page yet

export default function Reports() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [selectedStation, setSelectedStation] = useState<string>('');
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
  const reportData = reportResponse ?? { data: [] };

  const handleExport = () => {
    // Export current preview as CSV if available
    const rows = Array.isArray(reportData?.data) ? reportData.data : [];
    if (!rows || rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'No report data available for the selected range.' });
      return;
    }

    try {
      toast({ title: 'Export Started', description: 'Preparing CSV download...' });
      const csv = toCsv(rows as ReportRow[]);
      const filename = `report_${reportType}_${startDate}_${endDate}.csv`;
      downloadCsv(filename, csv);
      toast({ title: 'Export Ready', description: `Downloaded ${filename}` });
    } catch (err) {
      console.error('Export error', err);
      toast({ title: 'Export failed', description: 'Unable to generate CSV' });
    }
  };

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-muted-foreground">
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="station">Station</Label>
              <Select value={selectedStation || 'all'} onValueChange={(value) => setSelectedStation(value === 'all' ? '' : value)}>
                <SelectTrigger>
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
            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                <SelectTrigger>
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
            <div className="flex items-end">
              <Button onClick={handleExport} className="w-full">
                Export Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <span className="text-4xl">📊</span>
        <p className="text-muted-foreground">Reports preview</p>
        <p className="text-sm text-muted-foreground">Preview of generated report rows</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Quick view of the generated report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-3">
            <div />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  let csvData = reportData.data || [];
                  let filename = `report_${reportType}_${startDate}_${endDate}.csv`;

                  // Transform data based on report type for better CSV export
                  if (reportType === 'sales') {
                    csvData = (csvData as any[]).map(row => ({
                      Date: row.date || '',
                      'Total Sales': `₹${(row.totalSales ?? 0).toLocaleString('en-IN')}`,
                      'Total Quantity': `${(row.totalQuantity ?? 0).toLocaleString('en-IN')} L`,
                      Transactions: row.totalTransactions ?? 0
                    }));
                  } else if (reportType === 'daily-sales') {
                    csvData = (csvData as any[]).map(row => ({
                      Date: row.date || '',
                      'Total Sale Value': `₹${(row.totalSaleValue ?? 0).toLocaleString('en-IN')}`,
                      'Total Liters': `${(row.totalLiters ?? 0).toLocaleString('en-IN')} L`,
                      'Fuel Type': row.fuelType || ''
                    }));
                  } else if (reportType === 'sample-readings') {
                    csvData = (csvData as any[]).map(row => ({
                      Date: row.readingDate || '',
                      Pump: row.pumpName || row.pump || '',
                      Nozzle: row.nozzleNumber || row.nozzle || '',
                      'Opening Reading': `${(row.openingReading ?? 0).toLocaleString('en-IN')} L`,
                      'Closing Reading': `${(row.closingReading ?? 0).toLocaleString('en-IN')} L`,
                      'Fuel Type': row.fuelType || ''
                    }));
                  } else if (reportType === 'sample-statistics') {
                    csvData = (csvData as any[]).map(row => ({
                      'Fuel Type': row.fuelType || '',
                      'Total Sales': `₹${(row.totalSales ?? 0).toLocaleString('en-IN')}`,
                      'Total Quantity': `${(row.totalQuantity ?? 0).toLocaleString('en-IN')} L`,
                      'Average Price': `₹${(row.averagePrice ?? 0).toLocaleString('en-IN')}`,
                      Transactions: row.totalTransactions ?? 0
                    }));
                  }

                  const csv = toCsv(csvData);
                  downloadCsv(filename, csv);
                }}
              >
                Export CSV
              </Button>
            </div>
          </div>

          {/* Chart for sales reports */}
          {reportType === 'sales' && reportData && Array.isArray(reportData.data) && reportData.data.length > 0 && (
            (() => {
              const mapped = (reportData.data as any[])
                .map(r => ({
                  date: r.date || '',
                  sales: r.totalSales ?? 0,
                  quantity: r.totalQuantity ?? 0,
                  transactions: r.totalTransactions ?? 0
                }))
                .filter(d => d.date)
                .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

              return (
                <div style={{ width: '100%', height: 260 }} className="mb-4">
                  <ResponsiveContainer>
                    <AreaChart data={mapped} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
              );
            })()
          )}

          {/* Chart for daily sales reports */}
          {reportType === 'daily-sales' && reportData && Array.isArray(reportData.data) && reportData.data.length > 0 && (
            (() => {
              const mapped = (reportData.data as any[])
                .map(r => ({
                  date: r.date || '',
                  sales: r.totalSaleValue ?? 0,
                  liters: r.totalLiters ?? 0
                }))
                .filter(d => d.date)
                .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

              return (
                <div style={{ width: '100%', height: 260 }} className="mb-4">
                  <ResponsiveContainer>
                    <LineChart data={mapped} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
              );
            })()
          )}

          {isLoading ? (
            <div className="text-center text-muted-foreground">Loading report...</div>
          ) : !reportData || !Array.isArray(reportData.data) || reportData.data.length === 0 ? (
            <div className="text-center text-muted-foreground">
              {!Array.isArray(reportData?.data) ? 'Error loading report data' : 'No data for selected range'}
            </div>
          ) : (
            <>
              {/* Table for sales reports */}
              {reportType === 'sales' && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(reportData.data as any[]).map((row, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.date || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{(row.totalSales ?? 0).toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(row.totalQuantity ?? 0).toLocaleString('en-IN')} L</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.totalTransactions ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table for daily sales reports */}
              {reportType === 'daily-sales' && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sale Value</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Liters</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fuel Type</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(reportData.data as any[]).map((row, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.date || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{(row.totalSaleValue ?? 0).toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(row.totalLiters ?? 0).toLocaleString('en-IN')} L</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.fuelType || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table for sample readings reports */}
              {reportType === 'sample-readings' && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pump</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nozzle</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opening Reading</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Closing Reading</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fuel Type</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(reportData.data as any[]).map((row, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.readingDate || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.pumpName || row.pump || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.nozzleNumber || row.nozzle || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(row.openingReading ?? 0).toLocaleString('en-IN')} L</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(row.closingReading ?? 0).toLocaleString('en-IN')} L</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.fuelType || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table for sample statistics reports */}
              {reportType === 'sample-statistics' && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fuel Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Average Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(reportData.data as any[]).map((row, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.fuelType || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{(row.totalSales ?? 0).toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(row.totalQuantity ?? 0).toLocaleString('en-IN')} L</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{(row.averagePrice ?? 0).toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.totalTransactions ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
