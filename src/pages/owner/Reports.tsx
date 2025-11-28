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

  const handleExport = (reportType: string) => {
    // TODO: Implement CSV/PDF export functionality
    console.log(`Exporting ${reportType} report`);
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
                <Button variant="outline" size="sm" onClick={() => handleExport('sales')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
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

        {/* Shift Reports Tab */}
        <TabsContent value="shifts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Shift Reports</CardTitle>
                  <CardDescription>Employee shift details and performance</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleExport('shifts')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
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
                <Button variant="outline" size="sm" onClick={() => handleExport('pumps')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
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
