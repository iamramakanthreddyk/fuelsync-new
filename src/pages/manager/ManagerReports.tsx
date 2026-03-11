/**
 * Manager Reports - Minimal Station Analytics
 * 
 * Focused view for managers with:
 * - Today's performance snapshot
 * - Sales analytics (single station)
 * - Pump performance
 * - Quick expense overview
 */

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useStations } from '@/hooks/api';
import { useGlobalFilter } from '@/context/GlobalFilterContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangeFilterToolbar } from '@/components/DateRangeFilterToolbar';
import { BarChart3, Droplet, IndianRupee, TrendingUp, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  const { startDate, endDate } = useGlobalFilter();
  const [selectedTab, setSelectedTab] = useState('overview');
  const queryClient = useQueryClient();

  // Invalidate queries when dates change to force refetch
  useEffect(() => {
    if (startDate && endDate) {
      queryClient.invalidateQueries({ queryKey: ['manager-sales'] });
      queryClient.invalidateQueries({ queryKey: ['manager-pumps'] });
      queryClient.invalidateQueries({ queryKey: ['manager-expenses'] });
    }
  }, [startDate, endDate, queryClient]);

  // Get manager's station
  const stationsResponse = useStations().data;
  const stations = stationsResponse?.success ? stationsResponse.data : [];
  const currentStation = stations[0];

  // Fetch sales data using consolidated analytics endpoint
  const { data: salesResponse, isLoading: salesLoading, error: salesError } = useQuery({
    queryKey: ['manager-sales', startDate, endDate],
    queryFn: () =>
      apiClient.get<any>(
        `/analytics/daily?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!startDate && !!endDate,
  });

  // Fetch pump performance using consolidated analytics endpoint
  const { data: pumpsResponse, isLoading: pumpsLoading, error: pumpsError } = useQuery({
    queryKey: ['manager-pumps', startDate, endDate],
    queryFn: () =>
      apiClient.get<any>(
        `/analytics/pump-performance?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!startDate && !!endDate,
  });

  // Fetch expenses list using date range - use expenses endpoint which supports startDate/endDate
  const { data: expensesResponse, isLoading: expensesLoading, error: expensesError } = useQuery({
    queryKey: ['manager-expenses', currentStation?.id, startDate, endDate],
    queryFn: () =>
      apiClient.get<any>(
        `/stations/${currentStation?.id}/expenses?startDate=${startDate}&endDate=${endDate}&limit=100`
      ),
    enabled: !!currentStation?.id && !!startDate && !!endDate,
  });

  const sales: SalesData[] = Array.isArray(salesResponse?.data?.items) 
    ? salesResponse.data.items.map((item: any) => ({
        date: item.readingDate || item.date || '',
        litres: item.litres || 0,
        amount: item.amount || 0,
        cash: item.cash || 0,
        online: item.online || 0,
        readings: item.count || 0
      }))
    : [];
  const pumps: PumpPerformance[] = Array.isArray(pumpsResponse?.data?.pumps) 
    ? pumpsResponse.data.pumps.map((pump: any) => ({
        id: pump.pumpId || '',
        name: pump.pumpName || pump.pumpNumber || '',
        status: pump.totalSales > 0 ? 'active' : 'inactive',
        todaySales: pump.totalSales || 0,
        todayLitres: pump.totalQuantity || 0,
        nozzleCount: pump.nozzles?.length || 0
      }))
    : [];
  const expensesList: any[] = Array.isArray(expensesResponse?.data) ? expensesResponse.data : [];

  // Calculate totals from summary if available, fallback to calculated
  const totals = useMemo(() => {
    // Parse expense amounts from strings to numbers and sum them
    const expenseTotal = expensesList.reduce((sum, exp) => {
      const amount = typeof exp.amount === 'string' ? parseFloat(exp.amount) : (exp.amount || 0);
      return sum + amount;
    }, 0);
    
    // Use summary breakdown if available (from API response)
    if (salesResponse?.data?.summary) {
      const summary = salesResponse.data.summary;
      return {
        litres: summary.totalLitres || 0,
        amount: summary.totalAmount || 0,
        cash: summary.breakdown?.cash || 0,
        online: summary.breakdown?.online || 0,
        readings: summary.itemCount || 0,
        expenses: expenseTotal
      };
    }
    
    // Fallback: calculate from items
    const salesTotals = sales.reduce(
      (acc, day) => ({
        litres: acc.litres + (day.litres ?? 0),
        amount: acc.amount + (day.amount ?? 0),
        cash: acc.cash + (day.cash ?? 0),
        online: acc.online + (day.online ?? 0),
        readings: acc.readings + (day.readings ?? 0),
      }),
      { litres: 0, amount: 0, cash: 0, online: 0, readings: 0 }
    );
    return { ...salesTotals, expenses: expenseTotal };
  }, [sales, salesResponse?.data?.summary, expensesList]);

  const activePumps = pumps.filter(p => p.status === 'active').length;
  const totalPumpSales = pumps.reduce((sum, p) => sum + (p.todaySales ?? 0), 0);

  // Group expenses by category
  const expensesByCategory = useMemo(() => {
    const grouped: Record<string, { total: number; items: any[] }> = {};
    expensesList.forEach(exp => {
      const category = exp.category || 'uncategorized';
      const amount = typeof exp.amount === 'string' ? parseFloat(exp.amount) : (exp.amount || 0);
      if (!grouped[category]) {
        grouped[category] = { total: 0, items: [] };
      }
      grouped[category].total += amount;
      grouped[category].items.push(exp);
    });
    return grouped;
  }, [expensesList]);

  // Get expense stats
  const expenseStats = useMemo(() => {
    const approved = expensesList.filter(e => e.approvalStatus === 'auto_approved' || e.approvalStatus === 'approved').length;
    const pending = expensesList.filter(e => e.approvalStatus === 'pending').length;
    return { approved, pending, total: expensesList.length };
  }, [expensesList]);

  return (
    <>
      <div className="container mx-auto p-4 sm:p-6 space-y-4">
        <DateRangeFilterToolbar />
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

        {/* Loading State */}
        {(salesLoading || pumpsLoading || expensesLoading) && (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <p>Loading station data...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {(salesError || pumpsError || expensesError) && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <p className="text-sm text-red-700">
                {salesError?.message || pumpsError?.message || expensesError?.message || 'Error loading data'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        {!salesLoading && !pumpsLoading && !expensesLoading && (
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="pumps">Pumps</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
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
              {expensesList.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-red-600" />
                      Expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{fmt(totals.expenses ?? 0)}</div>
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

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="space-y-4">
            {expensesList.length > 0 ? (
              <>
                {/* Expense Summary Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        Approved
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{expenseStats.approved}</div>
                      <p className="text-xs text-muted-foreground mt-1">Expenses</p>
                    </CardContent>
                  </Card>

                  {expenseStats.pending > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                          Pending
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{expenseStats.pending}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Droplet className="w-4 h-4 text-red-600" />
                        Total
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">{fmt(totals.expenses)}</div>
                      <p className="text-xs text-muted-foreground mt-1">{expenseStats.total} items</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Expenses by Category */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Breakdown by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(expensesByCategory).map(([category, data]) => (
                        <div key={category} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-semibold capitalize">{category.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground mt-1">{data.items.length} item{data.items.length !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{fmt(data.total)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Detailed Expenses List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">All Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {expensesList.map((expense) => {
                        const amount = typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount;
                        return (
                          <div key={expense.id} className="flex items-start justify-between p-3 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900/20 rounded">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">{expense.description}</p>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {expense.category.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{expense.expenseDate} • {expense.enteredByUser?.name}</p>
                              {expense.notes && <p className="text-xs text-muted-foreground italic mt-1">{expense.notes}</p>}
                            </div>
                            <div className="text-right ml-2">
                              <p className="text-sm font-bold">{fmt(amount)}</p>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs mt-1 ${expense.approvalStatus === 'approved' || expense.approvalStatus === 'auto_approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30'}`}
                              >
                                {expense.approvalStatus === 'auto_approved' ? 'Auto Approved' : expense.approvalStatus}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <p className="text-sm text-muted-foreground text-center">No expenses recorded for this period</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        )}
      </div>
    </>
  );
}
