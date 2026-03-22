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
import { expenseApi, groupExpensesByCategory, getExpenseStats, parseExpenseAmount } from '@/api/expenses';
import type { Expense } from '@/api/expenses';
import { useStations } from '@/hooks/api';
import { useGlobalFilter } from '@/context/GlobalFilterContext';
import { useSettlements } from '@/hooks/useReportData';
import { formatCurrency } from '@/utils/formatting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangeFilterToolbar } from '@/components/DateRangeFilterToolbar';
import { BarChart3, Droplet, IndianRupee, TrendingUp, Clock, AlertCircle, CheckCircle2, LayoutDashboard, ShoppingCart, Gauge } from 'lucide-react';

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
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
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
    queryKey: ['manager-expenses', startDate, endDate],
    queryFn: () => expenseApi.getAll({ startDate, endDate, limit: 100 }),
    enabled: !!startDate && !!endDate,
  });

  // Fetch settlements to get shortfall/variance data
  const { data: settlementsData = [], isLoading: settlementsLoading } = useSettlements({
    dateRange: { startDate, endDate },
    selectedStation: currentStation?.id || '',
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
  const expensesList: Expense[] = expensesResponse?.data || [];

  // Calculate shortfall from settlements (sum of positive variances) - MUST be before totals calculation
  const shortfallInfo = useMemo(() => {
    if (!settlementsData || settlementsData.length === 0) {
      return { totalShortfall: 0, settlementCount: 0 };
    }
    const totalShortfall = settlementsData.reduce((sum, settlement: any) => {
      // Variance represents the difference: positive = shortfall (cash collected < expected)
      return sum + Math.max(0, settlement.variance || 0);
    }, 0);
    return { totalShortfall, settlementCount: settlementsData.length };
  }, [settlementsData]);

  // Calculate totals from summary if available, fallback to calculated
  const totals = useMemo(() => {
    // Use API summary if available, fallback to calculation
    if (expensesResponse?.summary) {
      const summary = expensesResponse.summary;
      const salesSummary = salesResponse?.data?.summary;
      
      return {
        litres: salesSummary?.totalLitres || 0,
        amount: salesSummary?.totalAmount || 0,
        cash: salesSummary?.breakdown?.cash || 0,
        online: salesSummary?.breakdown?.online || 0,
        readings: salesSummary?.itemCount || 0,
        expenses: summary.pendingTotal + summary.approvedTotal
      };
    }
    
    // Fallback: calculate from items
    let expenseTotal = 0;
    expensesList.forEach(exp => {
      expenseTotal += parseExpenseAmount(exp.amount);
    });

    const salesSummary = salesResponse?.data?.summary;
    if (salesSummary) {
      return {
        litres: salesSummary.totalLitres || 0,
        amount: salesSummary.totalAmount || 0,
        cash: salesSummary.breakdown?.cash || 0,
        online: salesSummary.breakdown?.online || 0,
        readings: salesSummary.itemCount || 0,
        expenses: expenseTotal,
        shortfall: shortfallInfo.totalShortfall
      };
    }

    // Final fallback: calculate from sales
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
    return { ...salesTotals, expenses: expenseTotal, shortfall: shortfallInfo.totalShortfall };
  }, [sales, salesResponse?.data?.summary, expensesList, expensesResponse?.summary, shortfallInfo.totalShortfall]);

  const activePumps = pumps.filter(p => p.status === 'active').length;
  const totalPumpSales = pumps.reduce((sum, p) => sum + (p.todaySales ?? 0), 0);

  // Group expenses by category
  const expensesByCategory = useMemo(() => {
    return groupExpensesByCategory(expensesList);
  }, [expensesList]);

  // Get expense stats
  const expenseStats = useMemo(() => {
    return getExpenseStats(expensesList);
  }, [expensesList]);

  return (
    <>
      <div className="w-full max-w-screen-xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        <DateRangeFilterToolbar />
        {/* Header */}
        <div className="flex items-start gap-3">
          <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">
              Station Reports
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 truncate">
              {currentStation?.name || 'Your Station'} • {startDate} to {endDate}
            </p>
          </div>
        </div>

        {/* Loading State */}
        {(salesLoading || pumpsLoading || expensesLoading || settlementsLoading) && (
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
        {!salesLoading && !pumpsLoading && !expensesLoading && !settlementsLoading && (
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="overview" className="flex flex-col sm:flex-row items-center gap-1 py-2 text-[10px] sm:text-sm">
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex flex-col sm:flex-row items-center gap-1 py-2 text-[10px] sm:text-sm">
              <ShoppingCart className="w-4 h-4 shrink-0" />
              <span>Sales</span>
            </TabsTrigger>
            <TabsTrigger value="pumps" className="flex flex-col sm:flex-row items-center gap-1 py-2 text-[10px] sm:text-sm">
              <Gauge className="w-4 h-4 shrink-0" />
              <span>Pumps</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex flex-col sm:flex-row items-center gap-1 py-2 text-[10px] sm:text-sm">
              <Droplet className="w-4 h-4 shrink-0" />
              <span>Expenses</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Total Sales */}
              <Card>
                <CardHeader className="pb-1 pt-3 px-3 sm:pb-2 sm:pt-4 sm:px-6">
                  <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
                    Total Sales
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 sm:px-6 sm:pb-4">
                  <div className="text-lg sm:text-2xl font-bold text-blue-600 truncate">{formatCurrency(totals.amount)}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{totals.litres}L dispensed</p>
                </CardContent>
              </Card>

              {/* Cash vs Online */}
              <Card>
                <CardHeader className="pb-1 pt-3 px-3 sm:pb-2 sm:pt-4 sm:px-6">
                  <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 shrink-0" />
                    Cash / Online
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 sm:px-6 sm:pb-4">
                  <div className="space-y-0.5">
                    <div className="text-xs">
                      <span className="font-semibold text-green-600 text-sm sm:text-base">{formatCurrency(totals.cash)}</span>
                      <span className="text-muted-foreground ml-1">cash</span>
                    </div>
                    <div className="text-xs">
                      <span className="font-semibold text-blue-600 text-sm sm:text-base">{formatCurrency(totals.online)}</span>
                      <span className="text-muted-foreground ml-1">online</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Readings */}
              <Card>
                <CardHeader className="pb-1 pt-3 px-3 sm:pb-2 sm:pt-4 sm:px-6">
                  <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 shrink-0" />
                    Readings
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 sm:px-6 sm:pb-4">
                  <div className="text-lg sm:text-2xl font-bold text-purple-600">{totals.readings}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">Nozzle entries</p>
                </CardContent>
              </Card>

              {/* Expenses */}
              {expensesList.length > 0 && (
                <Card>
                  <CardHeader className="pb-1 pt-3 px-3 sm:pb-2 sm:pt-4 sm:px-6">
                    <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5">
                      <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600 shrink-0" />
                      Expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 sm:px-6 sm:pb-4">
                    <div className="text-lg sm:text-2xl font-bold text-red-600 truncate">{formatCurrency(totals.expenses ?? 0)}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Total recorded</p>
                  </CardContent>
                </Card>
              )}

              {/* Shortfall / Cash Variance */}
              {shortfallInfo.settlementCount > 0 && (
                <Card>
                  <CardHeader className="pb-1 pt-3 px-3 sm:pb-2 sm:pt-4 sm:px-6">
                    <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600 shrink-0" />
                      Shortfall
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 sm:px-6 sm:pb-4">
                    <div className="text-lg sm:text-2xl font-bold text-orange-600 truncate">{formatCurrency(shortfallInfo.totalShortfall)}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">{shortfallInfo.settlementCount} settlement{shortfallInfo.settlementCount !== 1 ? 's' : ''}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Active Pumps Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Pump Status Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 sm:p-3">
                    <div className="text-xl sm:text-2xl font-bold text-green-600">{activePumps}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Active</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 sm:p-3">
                    <div className="text-base sm:text-2xl font-bold text-blue-600 truncate">{formatCurrency(totalPumpSales)}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Total sales</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-2 sm:p-3">
                    <div className="text-base sm:text-xl font-semibold text-gray-700 dark:text-gray-300 truncate">
                      {activePumps > 0 
                        ? formatCurrency(Math.round(totalPumpSales / activePumps))
                        : '—'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Avg/pump</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily Financial Summary P&L */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {/* Revenue */}
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-sm sm:text-base">Total Revenue</span>
                    <span className="font-bold text-sm sm:text-base whitespace-nowrap ml-2">{formatCurrency(totals.amount)}</span>
                  </div>

                  {/* Shortfall */}
                  {shortfallInfo.totalShortfall > 0 && (
                    <div className="flex justify-between py-2 text-muted-foreground">
                      <span className="text-xs sm:text-sm sm:pl-4">Less: Shortfall</span>
                      <span className="text-red-600 font-semibold text-xs sm:text-sm whitespace-nowrap ml-2">- {formatCurrency(shortfallInfo.totalShortfall)}</span>
                    </div>
                  )}

                  {/* Expenses */}
                  {totals.expenses > 0 && (
                    <div className="flex justify-between py-2 text-muted-foreground">
                      <span className="text-xs sm:text-sm sm:pl-4">Less: Operating Expenses</span>
                      <span className="text-red-600 font-semibold text-xs sm:text-sm whitespace-nowrap ml-2">- {formatCurrency(totals.expenses)}</span>
                    </div>
                  )}

                  {/* Net Summary */}
                  <div className="flex justify-between py-2 border-t border-b font-bold">
                    <span className="text-sm sm:text-base">Net Amount</span>
                    <span className={`text-sm sm:text-base whitespace-nowrap ml-2 ${totals.amount - shortfallInfo.totalShortfall - totals.expenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.max(0, totals.amount - shortfallInfo.totalShortfall - totals.expenses))}
                    </span>
                  </div>

                  {/* Transactions and Litres Summary */}
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>{totals.readings} transactions</span>
                    <span>{totals.litres}L dispensed</span>
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
                      <div key={idx} className="flex items-center justify-between py-2.5 px-1 border-b last:border-b-0 gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{day.date}</p>
                          <p className="text-xs text-muted-foreground">{day.litres}L • {day.readings} rdgs</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold">{formatCurrency(day.amount)}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(day.cash)} cash</p>
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
                      <div key={pump.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{pump.name}</p>
                            <Badge variant={pump.status === 'active' ? 'default' : 'secondary'} className="text-xs shrink-0">
                              {pump.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{pump.nozzleCount} nozzles</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold">{formatCurrency(pump.todaySales)}</p>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        Approved
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{expenseStats.approved}</div>
                      <p className="text-xs text-muted-foreground mt-1">{formatCurrency(expenseStats.approvedTotal)}</p>
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
                        <p className="text-xs text-muted-foreground mt-1">{formatCurrency(expenseStats.pendingTotal)}</p>
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
                      <div className="text-2xl font-bold text-red-600">{formatCurrency(expenseStats.totalAmount)}</div>
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
                            <p className="text-sm font-bold">{formatCurrency(data.total)}</p>
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
                        const amount = parseExpenseAmount(expense.amount);
                        return (
                          <div key={expense.id} className="flex items-start justify-between py-3 px-2 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900/20 rounded gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <p className="text-sm font-semibold">{expense.description}</p>
                                <Badge variant="outline" className="text-xs capitalize shrink-0">
                                  {expense.category.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{expense.expenseDate}{expense.enteredByUser?.name ? ` • ${expense.enteredByUser.name}` : ''}</p>
                              {expense.notes && <p className="text-xs text-muted-foreground italic mt-1 line-clamp-2">{expense.notes}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold">{formatCurrency(amount)}</p>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs mt-1 ${expense.approvalStatus === 'approved' || expense.approvalStatus === 'auto_approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30'}`}
                              >
                                {expense.approvalStatus === 'auto_approved' ? 'Auto' : expense.approvalStatus}
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
