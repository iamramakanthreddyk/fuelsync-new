/**
 * Manager Reports - Minimal Station Analytics
 * 
 * Focused view for managers with:
 * - Today's performance snapshot
 * - Sales analytics (single station)
 * - Pump performance
 * - Quick expense overview
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { useStations } from '@/hooks/api';
import { useGlobalFilter } from '@/context/GlobalFilterContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangeFilterToolbar } from '@/components/DateRangeFilterToolbar';
import { BarChart3, Droplet, IndianRupee, TrendingUp, Clock } from 'lucide-react';

interface SalesData {
  date: string;
  litres: number;
  amount: number;
  cash: number;
  online: number;
  readings: number;
}

interface PumpPerformance {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  todaySales: number;
  todayLitres: number;
  nozzleCount: number;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function ManagerReports() {
  const { user } = useAuth();
  const { startDate, endDate } = useGlobalFilter();
  const [selectedTab, setSelectedTab] = useState('overview');

  // Get manager's station
  const stationsResponse = useStations().data;
  const stations = stationsResponse?.success ? stationsResponse.data : [];
  const currentStation = stations[0];

  // Fetch sales data
  const { data: salesResponse } = useQuery({
    queryKey: ['manager-sales', currentStation?.id, startDate, endDate],
    queryFn: () =>
      apiClient.get<any>(
        `/stations/${currentStation?.id}/sales?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!currentStation?.id,
  });

  // Fetch pump performance
  const { data: pumpsResponse } = useQuery({
    queryKey: ['manager-pumps', currentStation?.id, startDate, endDate],
    queryFn: () =>
      apiClient.get<any>(
        `/stations/${currentStation?.id}/pumps?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!currentStation?.id,
  });

  // Fetch expenses summary
  const { data: expensesResponse } = useQuery({
    queryKey: ['manager-expenses', currentStation?.id, startDate, endDate],
    queryFn: () =>
      apiClient.get<any>(
        `/stations/${currentStation?.id}/expense-summary?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!currentStation?.id,
  });

  const sales: SalesData[] = (salesResponse as any)?.data?.sales ?? [];
  const pumps: PumpPerformance[] = (pumpsResponse as any)?.data?.pumps ?? [];
  const expenses = (expensesResponse as any)?.data;

  // Calculate totals
  const totals = useMemo(() => {
    return sales.reduce(
      (acc, day) => ({
        litres: acc.litres + (day.litres ?? 0),
        amount: acc.amount + (day.amount ?? 0),
        cash: acc.cash + (day.cash ?? 0),
        online: acc.online + (day.online ?? 0),
        readings: acc.readings + (day.readings ?? 0),
      }),
      { litres: 0, amount: 0, cash: 0, online: 0, readings: 0 }
    );
  }, [sales]);

  const activePumps = pumps.filter(p => p.status === 'active').length;
  const totalPumpSales = pumps.reduce((sum, p) => sum + (p.todaySales ?? 0), 0);

  return (
    <>
      <DateRangeFilterToolbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6 pt-16">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-blue-600" />
            Station Reports
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {currentStation?.name || 'Your Station'} • {startDate} to {endDate}
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="pumps">Pumps</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Sales */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-blue-600" />
                    Total Sales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{fmt(totals.amount)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{totals.litres}L dispensed</p>
                </CardContent>
              </Card>

              {/* Cash vs Online */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    Cash vs Online
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="text-xs">
                      <span className="font-semibold text-green-600">{fmt(totals.cash)}</span>
                      <span className="text-muted-foreground ml-1">cash</span>
                    </div>
                    <div className="text-xs">
                      <span className="font-semibold text-blue-600">{fmt(totals.online)}</span>
                      <span className="text-muted-foreground ml-1">online</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Readings */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    Readings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{totals.readings}</div>
                  <p className="text-xs text-muted-foreground mt-1">Nozzle readings recorded</p>
                </CardContent>
              </Card>

              {/* Expenses */}
              {expenses && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-red-600" />
                      Expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{fmt(expenses.totalExpenses ?? 0)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total recorded</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Active Pumps Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pump Status Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{activePumps}</div>
                    <p className="text-xs text-muted-foreground">Active pumps</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{fmt(totalPumpSales)}</div>
                    <p className="text-xs text-muted-foreground">Total pump sales</p>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-sm text-muted-foreground">
                      {activePumps > 0 
                        ? `${(totalPumpSales / activePumps).toFixed(0)} avg per pump`
                        : 'No active pumps'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Daily Sales Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sales.length > 0 ? (
                    sales.map((day, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 border-b last:border-b-0">
                        <div>
                          <p className="text-sm font-semibold">{day.date}</p>
                          <p className="text-xs text-muted-foreground">{day.litres}L • {day.readings} readings</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{fmt(day.amount)}</p>
                          <p className="text-xs text-muted-foreground">{fmt(day.cash)} cash</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No sales data</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pumps Tab */}
          <TabsContent value="pumps" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pump Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pumps.length > 0 ? (
                    pumps.map(pump => (
                      <div key={pump.id} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                        <div>
                          <p className="text-sm font-semibold">{pump.name}</p>
                          <p className="text-xs text-muted-foreground">{pump.nozzleCount} nozzles</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <Badge variant={pump.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                              {pump.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-sm font-bold mt-1">{fmt(pump.todaySales)}</p>
                          <p className="text-xs text-muted-foreground">{pump.todayLitres}L</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No pump data</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
