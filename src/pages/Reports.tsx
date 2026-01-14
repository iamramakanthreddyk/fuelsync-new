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
import { useReports, ReportType, ReportRow } from '@/hooks/useReports';
import { toCsv, downloadCsv } from '@/lib/csv';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { safeToFixed } from '@/lib/format-utils';
import { useStations } from '@/hooks/api';
// charts are not used in this page yet

export default function Reports() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState('daily');
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
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Sales</SelectItem>
                  <SelectItem value="monthly">Monthly Summary</SelectItem>
                  <SelectItem value="pump">Pump Performance</SelectItem>
                  <SelectItem value="fuel">Fuel Analysis</SelectItem>
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
                  const csv = toCsv(reportData.data || []);
                  downloadCsv(`report_${reportType}_${startDate}_${endDate}.csv`, csv);
                }}
              >
                Export CSV
              </Button>
            </div>
          </div>

          {/* If daily report, show a small trend chart */}
          {reportType === 'daily' && reportData && Array.isArray(reportData.data) && reportData.data.length > 0 && (
            (() => {
              const mapped = (reportData.data as ReportRow[])
                .map(r => ({
                  date: r.date || r.readingDate || r.day || r.label || '',
                  sales: r.sales ?? r.totalSales ?? r.amount ?? r.total_amount ?? r.revenue ?? 0
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

          {isLoading ? (
            <div className="text-center text-muted-foreground">Loading report...</div>
          ) : !reportData || !Array.isArray(reportData.data) || reportData.data.length === 0 ? (
            <div className="text-center text-muted-foreground">
              {!Array.isArray(reportData?.data) ? 'Error loading report data' : 'No data for selected range'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted">
                  <tr className="text-left border-b">
                    {Object.keys(reportData.data[0] || {}).map((h) => (
                      <th key={h} className="p-3 font-semibold text-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.data.map((row: ReportRow, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-muted/50 transition-colors">
                      {Object.entries(row).map(([key, val]) => (
                        <td key={key} className="p-3 text-foreground">
                          {typeof val === 'string' && val.includes('₹') ? val : typeof val === 'number' ? val.toLocaleString('en-IN') : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
