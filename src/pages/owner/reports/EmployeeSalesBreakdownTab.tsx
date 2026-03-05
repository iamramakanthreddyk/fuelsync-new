/**
 * Employee Sales Breakdown Tab
 * 
 * Shows per-employee:
 * - Total sales broken down by fuel type
 * - Payment method split (cash/online/credit)
 * - Variance tracking
 * - Transaction count
 */

import React, { useState } from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReportSection, StatCard } from '@/components/reports';

import { useEmployeeSalesBreakdown } from '@/hooks/useEmployeeSalesBreakdown';
import { safeToFixed } from '@/lib/format-utils';
import { AlertCircle, TrendingUp, Droplet, DollarSign, Users } from 'lucide-react';
import type { DateRange } from '@/components/reports';

interface EmployeeSalesBreakdownTabProps {
  dateRange: DateRange;
  selectedStation: string;
}

// Color helpers for fuel types
const getFuelColor = (fuelType: string) => {
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    petrol: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    diesel: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
    cng: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    premium_petrol: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  };
  return colors[fuelType.toLowerCase()] || { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' };
};

const getVarianceColor = (status?: string) => {
  switch (status?.toUpperCase()) {
    case 'SHORTFALL':
      return { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-800' };
    case 'OVERAGE':
      return { bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' };
    case 'BALANCED':
      return { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100 text-green-800' };
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800' };
  }
};

export const EmployeeSalesBreakdownTab: React.FC<EmployeeSalesBreakdownTabProps> = ({
  dateRange,
  selectedStation,
}) => {
  const hasValidDates = dateRange?.startDate && dateRange?.endDate;
  const hasValidStation = selectedStation && selectedStation !== '';

  const { data: salesData, isLoading } = useEmployeeSalesBreakdown(
    hasValidStation ? selectedStation : undefined,
    hasValidDates ? dateRange.startDate : '',
    hasValidDates ? dateRange.endDate : ''
  );

  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const employees = salesData?.data ?? [];
  const summary = salesData?.summary;

  const topEmployee = employees.length > 0
    ? employees.reduce((max, e) => (e.totalSales > max.totalSales ? e : max))
    : null;

  const paymentMethodStats = summary ? [
    { label: 'Cash', amount: summary.totalCash, percentage: (summary.totalCash / summary.totalSales) * 100 },
    { label: 'Online', amount: summary.totalOnline, percentage: (summary.totalOnline / summary.totalSales) * 100 },
    { label: 'Credit', amount: summary.totalCredit, percentage: (summary.totalCredit / summary.totalSales) * 100 },
  ] : [];

  return (
    <TabsContent value="employee-sales" className="space-y-4">
      <ReportSection
        title="Employee Sales Breakdown"
        description="Sales by employee, fuel type, and payment method with variance tracking"
        isLoading={isLoading}
        loadingText="Loading employee sales data..."
        isEmpty={employees.length === 0}
        emptyState={{
          icon: AlertCircle,
          title: 'No Sales Data',
          description: 'No employee sales found for the selected period.',
        }}
      >
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={DollarSign}
              title="Total Sales"
              value={`₹${summary ? safeToFixed(summary.totalSales, 2) : '0'}`}
              trend={{ value: 0, direction: 'neutral' as const }}
              variant="blue"
            />
            <StatCard
              icon={Droplet}
              title="Total Quantity"
              value={`${summary ? safeToFixed(summary.totalQuantity, 0) : '0'} L`}
              trend={{ value: 0, direction: 'neutral' as const }}
              variant="green"
            />
            <StatCard
              icon={Users}
              title="Employees"
              value={`${summary?.totalEmployees ?? 0}`}
              trend={{ value: 0, direction: 'neutral' as const }}
              variant="purple"
            />
            <StatCard
              icon={TrendingUp}
              title="Avg. per Employee"
              value={`₹${summary && summary.totalEmployees > 0 ? safeToFixed(summary.totalSales / summary.totalEmployees, 0) : '0'}`}
              trend={{ value: 0, direction: 'neutral' as const }}
              variant="orange"
            />
          </div>

          {/* Payment Method Breakdown */}
          {paymentMethodStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Payment Method Split</CardTitle>
                <CardDescription>Total sales by payment type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paymentMethodStats.map((method) => (
                    <div key={method.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium">{method.label}</div>
                        <div className="text-sm font-semibold">
                          ₹{safeToFixed(method.amount, 0)} ({safeToFixed(method.percentage, 1)}%)
                        </div>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            method.label === 'Cash'
                              ? 'bg-blue-500'
                              : method.label === 'Online'
                                ? 'bg-green-500'
                                : 'bg-amber-500'
                          }`}
                          style={{ width: `${method.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Performer */}
          {topEmployee && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader>
                <CardTitle className="text-sm">Top Performer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-lg">{topEmployee.employeeName}</div>
                    <div className="text-sm text-muted-foreground">
                      {topEmployee.totalTransactions} transactions
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-amber-700">
                      ₹{safeToFixed(topEmployee.totalSales, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {safeToFixed(topEmployee.totalQuantity, 0)} L
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Employee Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Employee Details</h3>
            {employees.map((employee) => (
              <Card
                key={employee.employeeId}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() =>
                  setExpandedEmployee(expandedEmployee === employee.employeeId ? null : employee.employeeId)
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{employee.employeeName}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {employee.totalTransactions} transactions • {safeToFixed(employee.totalQuantity, 0)} L sold
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-900">
                        ₹{safeToFixed(employee.totalSales, 0)}
                      </div>
                      {employee.variance && (
                        <Badge className={getVarianceColor(employee.variance.status).badge}>
                          {employee.variance.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* Expanded Details */}
                {expandedEmployee === employee.employeeId && (
                  <CardContent className="space-y-4 border-t pt-4">
                    {/* Payment Breakdown */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
                        <div className="text-xs font-medium text-muted-foreground">Cash</div>
                        <div className="text-lg font-semibold text-blue-700">
                          ₹{safeToFixed(employee.totalCash, 0)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {safeToFixed((employee.totalCash / employee.totalSales) * 100, 1)}%
                        </div>
                      </div>
                      <div className="p-3 rounded-md bg-green-50 border border-green-200">
                        <div className="text-xs font-medium text-muted-foreground">Online</div>
                        <div className="text-lg font-semibold text-green-700">
                          ₹{safeToFixed(employee.totalOnline, 0)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {safeToFixed((employee.totalOnline / employee.totalSales) * 100, 1)}%
                        </div>
                      </div>
                      <div className="p-3 rounded-md bg-amber-50 border border-amber-200">
                        <div className="text-xs font-medium text-muted-foreground">Credit</div>
                        <div className="text-lg font-semibold text-amber-700">
                          ₹{safeToFixed(employee.totalCredit, 0)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {safeToFixed((employee.totalCredit / employee.totalSales) * 100, 1)}%
                        </div>
                      </div>
                    </div>

                    {/* Fuel Type Breakdown */}
                    {employee.byFuelType && employee.byFuelType.length > 0 && (
                      <div className="space-y-2 border-t pt-4">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Sales by Fuel Type
                        </h4>
                        <div className="space-y-2">
                          {employee.byFuelType.map((fuel) => {
                            const colors = getFuelColor(fuel.fuelType);
                            return (
                              <div
                                key={fuel.fuelType}
                                className={`p-3 rounded-md border ${colors.bg}`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
                                    <span className="text-sm font-medium capitalize">{fuel.fuelType}</span>
                                  </div>
                                  <span className={`text-sm font-semibold ${colors.text}`}>
                                    ₹{safeToFixed(fuel.saleValue, 0)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <div className="text-muted-foreground">Quantity</div>
                                    <div className="font-medium">{safeToFixed(fuel.quantity, 0)} L</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Transactions</div>
                                    <div className="font-medium">{fuel.transactionCount}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Avg. Txn</div>
                                    <div className="font-medium">₹{safeToFixed(fuel.averageTransactionValue, 0)}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Variance */}
                    {employee.variance && (
                      <div className={`p-3 rounded-md border-l-4 ${getVarianceColor(employee.variance.status).bg}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">Variance</div>
                            <div className="text-sm text-muted-foreground">
                              {employee.variance.status}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${getVarianceColor(employee.variance.status).text}`}>
                              ₹{safeToFixed(Math.abs(employee.variance.amount), 0)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {safeToFixed(Math.abs(employee.variance.percentage), 1)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      </ReportSection>
    </TabsContent>
  );
};
