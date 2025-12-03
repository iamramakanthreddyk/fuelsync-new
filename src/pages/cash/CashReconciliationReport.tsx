/**
 * Cash Reconciliation Report Page
 * 
 * Daily/Weekly/Monthly/Yearly views of:
 * - Total sales
 * - Cash collected vs expected
 * - Online payments
 * - Credit given
 * - Discrepancies
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

import {
  Banknote,
  Smartphone,
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { cashHandoverService } from '@/services/tenderService';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type TimePeriod = 'today' | 'week' | 'month' | 'year';

interface CashSummary {
  totalSales: number;
  totalCashExpected: number;
  totalCashCollected: number;
  totalOnlineCollected: number;
  totalCreditGiven: number;
  cashDiscrepancy: number;
  shiftsCount: number;
  pendingHandovers: number;
  disputedHandovers: number;
}

export default function CashReconciliationReport() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<TimePeriod>('today');
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [expandedShifts, setExpandedShifts] = useState<Set<number>>(new Set());

  // Get date range based on period
  const getDateRange = (p: TimePeriod) => {
    const now = new Date();
    switch (p) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  const dateRange = getDateRange(period);

  // Fetch shifts for the period
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts-report', period, selectedStation],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
      });
      if (selectedStation !== 'all') {
        params.append('stationId', selectedStation);
      }
      const response = await apiClient.get<any[]>(`/shifts?${params.toString()}`);
      return response || [];
    },
  });

  // Fetch handovers for the period
  const { data: handovers = [], isLoading: handoversLoading } = useQuery({
    queryKey: ['handovers-report', period, selectedStation],
    queryFn: async () => {
      try {
        const pending = await cashHandoverService.getPendingHandovers();
        return pending || [];
      } catch {
        return [];
      }
    },
  });

  // Fetch stations
  const { data: stations = [] } = useQuery({
    queryKey: ['stations-list'],
    queryFn: async () => {
      const response = await apiClient.get<any[]>('/stations');
      return response || [];
    },
  });

  // Calculate summary
  const summary: CashSummary = shifts.reduce((acc, shift) => {
    return {
      totalSales: acc.totalSales + (shift.totalSalesAmount || 0),
      totalCashExpected: acc.totalCashExpected + (shift.expectedCash || 0),
      totalCashCollected: acc.totalCashCollected + (shift.cashCollected || 0),
      totalOnlineCollected: acc.totalOnlineCollected + (shift.onlineCollected || 0),
      totalCreditGiven: acc.totalCreditGiven + 0, // Would come from readings
      cashDiscrepancy: acc.cashDiscrepancy + (shift.cashDifference || 0),
      shiftsCount: acc.shiftsCount + 1,
      pendingHandovers: acc.pendingHandovers,
      disputedHandovers: acc.disputedHandovers,
    };
  }, {
    totalSales: 0,
    totalCashExpected: 0,
    totalCashCollected: 0,
    totalOnlineCollected: 0,
    totalCreditGiven: 0,
    cashDiscrepancy: 0,
    shiftsCount: 0,
    pendingHandovers: handovers.filter((h: any) => h.status === 'pending').length,
    disputedHandovers: handovers.filter((h: any) => h.status === 'disputed').length,
  });

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '₹0';
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const toggleShiftExpand = (shiftId: number) => {
    setExpandedShifts(prev => {
      const next = new Set(prev);
      if (next.has(shiftId)) {
        next.delete(shiftId);
      } else {
        next.add(shiftId);
      }
      return next;
    });
  };

  if (!user) return null;

  const isLoading = shiftsLoading || handoversLoading;

  // Calculate percentages for breakdown
  const totalCollected = summary.totalCashCollected + summary.totalOnlineCollected;
  const cashPercentage = totalCollected > 0 ? (summary.totalCashCollected / totalCollected) * 100 : 0;
  const onlinePercentage = totalCollected > 0 ? (summary.totalOnlineCollected / totalCollected) * 100 : 0;

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="w-6 h-6 text-green-600" />
            Cash Reconciliation Report
          </h1>
          <p className="text-muted-foreground">
            Track sales, collections, and discrepancies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedStation} onValueChange={setSelectedStation}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Stations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stations</SelectItem>
              {stations.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" title="Export Report">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Period Tabs */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as TimePeriod)}>
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
          <TabsTrigger value="year">This Year</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="space-y-6 mt-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Sales */}
            <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Total Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">
                  {isLoading ? '--' : formatCurrency(summary.totalSales)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.shiftsCount} shifts completed
                </p>
              </CardContent>
            </Card>

            {/* Cash Collected */}
            <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Banknote className="w-4 h-4" />
                  Cash Collected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {isLoading ? '--' : formatCurrency(summary.totalCashCollected)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Expected: {formatCurrency(summary.totalCashExpected)}
                </p>
              </CardContent>
            </Card>

            {/* Online Collected */}
            <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Smartphone className="w-4 h-4" />
                  Online Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-purple-600">
                  {isLoading ? '--' : formatCurrency(summary.totalOnlineCollected)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {onlinePercentage.toFixed(1)}% of collections
                </p>
              </CardContent>
            </Card>

            {/* Discrepancy */}
            <Card className={cn(
              "bg-gradient-to-br to-white",
              summary.cashDiscrepancy < 0 
                ? "from-red-50 dark:from-red-950/30" 
                : summary.cashDiscrepancy > 0 
                ? "from-yellow-50 dark:from-yellow-950/30"
                : "from-green-50 dark:from-green-950/30"
            )}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  {summary.cashDiscrepancy < 0 ? (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                  Cash Variance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={cn(
                  "text-2xl font-bold",
                  summary.cashDiscrepancy < 0 ? "text-red-600" : 
                  summary.cashDiscrepancy > 0 ? "text-yellow-600" : "text-green-600"
                )}>
                  {isLoading ? '--' : formatCurrency(summary.cashDiscrepancy)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.cashDiscrepancy < 0 ? 'Shortage' : 
                   summary.cashDiscrepancy > 0 ? 'Excess' : 'Balanced'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Collection Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Collection Breakdown</CardTitle>
              <CardDescription>Distribution of payments by type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cash */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <Banknote className="w-4 h-4 text-green-500" />
                    Cash
                  </span>
                  <span className="font-medium">{formatCurrency(summary.totalCashCollected)}</span>
                </div>
                <Progress value={cashPercentage} className="h-2 bg-green-100">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${cashPercentage}%` }} />
                </Progress>
              </div>
              
              {/* Online */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <Smartphone className="w-4 h-4 text-purple-500" />
                    Online (UPI/Card)
                  </span>
                  <span className="font-medium">{formatCurrency(summary.totalOnlineCollected)}</span>
                </div>
                <Progress value={onlinePercentage} className="h-2 bg-purple-100">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${onlinePercentage}%` }} />
                </Progress>
              </div>

              {/* Credit */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <CreditCard className="w-4 h-4 text-orange-500" />
                    Credit Given
                  </span>
                  <span className="font-medium">{formatCurrency(summary.totalCreditGiven)}</span>
                </div>
                <Progress value={0} className="h-2 bg-orange-100" />
              </div>
            </CardContent>
          </Card>

          {/* Alerts Section */}
          {(summary.pendingHandovers > 0 || summary.disputedHandovers > 0 || summary.cashDiscrepancy < 0) && (
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  Attention Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary.pendingHandovers > 0 && (
                    <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                      <span className="text-sm">Pending handovers to confirm</span>
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                        {summary.pendingHandovers}
                      </Badge>
                    </div>
                  )}
                  {summary.disputedHandovers > 0 && (
                    <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                      <span className="text-sm text-red-600">Disputed handovers</span>
                      <Badge variant="destructive">{summary.disputedHandovers}</Badge>
                    </div>
                  )}
                  {summary.cashDiscrepancy < 0 && (
                    <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                      <span className="text-sm text-red-600">Cash shortage detected</span>
                      <Badge variant="destructive">{formatCurrency(Math.abs(summary.cashDiscrepancy))}</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shifts Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Shift Details</CardTitle>
              <CardDescription>Individual shift cash reconciliation</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : shifts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No shifts found for this period</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Date / Time</TableHead>
                      <TableHead>Station</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Sales</TableHead>
                      <TableHead className="text-right">Cash</TableHead>
                      <TableHead className="text-right">Online</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((shift: any) => (
                      <>
                        <TableRow 
                          key={shift.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleShiftExpand(shift.id)}
                        >
                          <TableCell>
                            {expandedShifts.has(shift.id) ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {shift.shiftDate ? format(new Date(shift.shiftDate), 'dd MMM yyyy') : '--'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {shift.startTime ? format(new Date(`2000-01-01T${shift.startTime}`), 'hh:mm a') : '--'}
                                {shift.endTime && ` - ${format(new Date(`2000-01-01T${shift.endTime}`), 'hh:mm a')}`}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {shift.station?.name || 'Unknown'}
                            </span>
                          </TableCell>
                          <TableCell>{shift.employee?.name || 'Unknown'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(shift.totalSalesAmount)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(shift.cashCollected)}
                          </TableCell>
                          <TableCell className="text-right text-purple-600">
                            {formatCurrency(shift.onlineCollected)}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-medium",
                            (shift.cashDifference || 0) < 0 ? "text-red-600" :
                            (shift.cashDifference || 0) > 0 ? "text-yellow-600" : "text-green-600"
                          )}>
                            {formatCurrency(shift.cashDifference)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={shift.status === 'ended' ? 'secondary' : 'outline'}>
                              {shift.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {expandedShifts.has(shift.id) && (
                          <TableRow key={`${shift.id}-detail`}>
                            <TableCell colSpan={9} className="bg-muted/30 p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Expected Cash</p>
                                  <p className="font-medium">{formatCurrency(shift.expectedCash)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Readings Count</p>
                                  <p className="font-medium">{shift.readingsCount || 0}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Total Litres</p>
                                  <p className="font-medium">{shift.totalLitresSold?.toFixed(2) || '0'} L</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Ended By</p>
                                  <p className="font-medium">{shift.endedByUser?.name || shift.employee?.name || '--'}</p>
                                </div>
                                {shift.notes && (
                                  <div className="col-span-2">
                                    <p className="text-muted-foreground">Notes</p>
                                    <p className="font-medium">{shift.notes}</p>
                                  </div>
                                )}
                                {shift.endNotes && (
                                  <div className="col-span-2">
                                    <p className="text-muted-foreground">End Notes</p>
                                    <p className="font-medium">{shift.endNotes}</p>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
