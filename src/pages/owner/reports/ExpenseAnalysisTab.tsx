import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingDown, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Expense } from '@/types/api';
import type { DateRange } from '@/components/reports/FilterBar';
import { safeToFixed } from '@/lib/format-utils';

interface ExpenseAnalysisTabProps {
  expenses: Expense[];
  isLoading: boolean;
  dateRange: DateRange;
  totalRevenue?: number;
}

const EXPENSE_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#06b6d4', '#0ea5e9', '#6366f1'];

export const ExpenseAnalysisTab: React.FC<ExpenseAnalysisTabProps> = ({
  expenses,
  isLoading,
  dateRange,
  totalRevenue = 0,
}) => {
  // Group expenses by category
  const expensesByCategory = React.useMemo(() => {
    const grouped: Record<string, { amount: number; count: number }> = {};
    expenses.forEach((exp: any) => {
      const category = exp.category || 'uncategorized';
      if (!grouped[category]) {
        grouped[category] = { amount: 0, count: 0 };
      }
      // Ensure amount is a number (API may return string)
      const amt = typeof exp.amount === 'string' ? parseFloat(exp.amount) : exp.amount || 0;
      grouped[category].amount += amt;
      grouped[category].count += 1;
    });
    return Object.entries(grouped)
      .map(([category, data]) => ({
        category: category.replace(/_/g, ' '),
        amount: data.amount,
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  // Calculate totals
  const totalExpenses = React.useMemo(
    () => expensesByCategory.reduce((sum, item) => sum + item.amount, 0),
    [expensesByCategory]
  );

  // Group by approval status
  const approvalBreakdown = React.useMemo(() => {
    const getAmount = (e: any) => typeof e.amount === 'string' ? parseFloat(e.amount) : e.amount || 0;
    const approved = expenses.filter((e: any) => e.approvalStatus === 'approved' || e.approvalStatus === 'auto_approved')
      .reduce((sum, e: any) => sum + getAmount(e), 0);
    const pending = expenses.filter((e: any) => e.approvalStatus === 'pending')
      .reduce((sum, e: any) => sum + getAmount(e), 0);
    const rejected = expenses.filter((e: any) => e.approvalStatus === 'rejected')
      .reduce((sum, e: any) => sum + getAmount(e), 0);
    return { approved, pending, rejected };
  }, [expenses]);

  if (isLoading) {
    return (
      <TabsContent value="expenses" className="space-y-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Loading expense data...</p>
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  if (expenses.length === 0) {
    return (
      <TabsContent value="expenses" className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            No expenses recorded for this period ({dateRange.startDate} to {dateRange.endDate})
          </AlertDescription>
        </Alert>
      </TabsContent>
    );
  }

  // Prepare pie chart data
  const pieData = expensesByCategory.slice(0, 8).map((item) => ({
    name: item.category,
    value: item.amount,
  }));

  return (
    <TabsContent value="expenses" className="space-y-4">
      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600">₹{safeToFixed(totalExpenses, 0)}</p>
              </div>
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {expenses.length} transaction{expenses.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        {/* Approved Expenses */}
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Approved</p>
              <p className="text-xl font-bold text-green-600">₹{safeToFixed(approvalBreakdown.approved, 0)}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Counted in P&L
            </p>
          </CardContent>
        </Card>

        {/* Pending Expenses */}
        {approvalBreakdown.pending > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
                <p className="text-xl font-bold text-amber-600">₹{safeToFixed(approvalBreakdown.pending, 0)}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Awaiting review
              </p>
            </CardContent>
          </Card>
        )}

        {/* Expense as % of Revenue */}
        {totalRevenue > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expense Ratio</p>
                <p className="text-xl font-bold text-blue-600">
                  {safeToFixed((totalExpenses / totalRevenue) * 100, 1)}%
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Of total revenue
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Expense Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Breakdown Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">By Category</CardTitle>
            <CardDescription>Top expense categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expensesByCategory.map((item, idx) => (
                <div key={item.category} className="flex items-center justify-between p-2.5 sm:p-3 border rounded-lg gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: EXPENSE_COLORS[idx % EXPENSE_COLORS.length] }}
                    />
                    <div className="min-w-0">
                      <div className="font-medium capitalize text-sm truncate">{item.category}</div>
                      <div className="text-xs text-muted-foreground">{item.count} item{item.count !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div className="text-right font-semibold text-red-600 shrink-0 text-sm">
                    ₹{safeToFixed(item.amount, 0)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Distribution</CardTitle>
              <CardDescription>Expense breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ₹${safeToFixed(value, 0)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `₹${safeToFixed(value, 0)}`}
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Approval Status Summary */}
      {approvalBreakdown.pending > 0 || approvalBreakdown.rejected > 0 && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Note:</strong> Only approved expenses are included in profit calculations.
            {approvalBreakdown.pending > 0 && ` ₹${safeToFixed(approvalBreakdown.pending, 0)} pending approval.`}
            {approvalBreakdown.rejected > 0 && ` ₹${safeToFixed(approvalBreakdown.rejected, 0)} rejected.`}
          </AlertDescription>
        </Alert>
      )}
    </TabsContent>
  );
};
