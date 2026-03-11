/**
 * Expenses Page — Req #3
 *
 * Allows managers and owners to:
 *   • View daily and monthly expense breakdown
 *   • Add new expenses with category, frequency, and tags
 *   • Approve / reject employee-submitted pending expenses
 *
 * Employees can:
 *   • Add expenses (goes into "pending" until approved)
 *   • View their own entries
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useStations } from '@/hooks/api';
import { useGlobalFilter } from '@/context/GlobalFilterContext';
import { DateRangeFilterToolbar } from '@/components/DateRangeFilterToolbar';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Receipt,
  TrendingDown,
  IndianRupee,
} from 'lucide-react';

import { ExpenseSimpleFilter } from '@/components/filters/ExpenseSimpleFilter';
import type { Expense, Station } from '@/types/api';
import type { ExpenseFrequency, ExpenseApprovalStatus } from '@/types/finance';
import { FREQUENCY_LABELS, APPROVAL_STATUS_LABELS } from '@/types/finance';

// ── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES: Record<string, string> = {
  salary: 'Salary',
  electricity: 'Electricity',
  rent: 'Rent / Lease',
  insurance: 'Insurance',
  loan_emi: 'Loan EMI',
  cleaning: 'Cleaning',
  generator_fuel: 'Generator Fuel',
  drinking_water: 'Drinking Water',
  maintenance: 'Maintenance / Repair',
  equipment_purchase: 'Equipment Purchase',
  taxes: 'Taxes & Govt Fees',
  transportation: 'Transportation',
  supplies: 'Supplies',
  miscellaneous: 'Miscellaneous',
};

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'Cash',
  online: 'Online Transfer',
  card: 'Debit / Credit Card',
};

const APPROVAL_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  auto_approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
};

const APPROVAL_ICON: Record<string, JSX.Element> = {
  pending: <Clock className="w-3 h-3" />,
  approved: <CheckCircle2 className="w-3 h-3" />,
  auto_approved: <CheckCircle2 className="w-3 h-3" />,
  rejected: <XCircle className="w-3 h-3" />,
};

// ── Helper ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ── Components ────────────────────────────────────────────────────────────────

interface AddExpenseFormProps {
  stationId: string;
  onSuccess: () => void;
}

function AddExpenseForm({ stationId, onSuccess }: AddExpenseFormProps) {
  const [category, setCategory] = useState('miscellaneous');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [frequency, setFrequency] = useState<ExpenseFrequency>('one_time');
  const [tags, setTags] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post(`/stations/${stationId}/expenses`, data),
    onSuccess: () => {
      toast.success('Expense recorded successfully');
      onSuccess();
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to record expense');
    },
  });

  // Auto-suggest frequency when category changes
  const SUGGESTED_FREQ: Record<string, ExpenseFrequency> = {
    salary: 'monthly', electricity: 'monthly', rent: 'monthly',
    insurance: 'monthly', loan_emi: 'monthly', generator_fuel: 'monthly',
    drinking_water: 'monthly', cleaning: 'weekly',
    maintenance: 'one_time', equipment_purchase: 'one_time',
    taxes: 'one_time', transportation: 'one_time', supplies: 'one_time', miscellaneous: 'one_time',
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setFrequency(SUGGESTED_FREQ[cat] ?? 'one_time');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    mutation.mutate({
      stationId,
      category,
      description,
      amount: parseFloat(amount),
      expenseDate,
      paymentMethod,
      frequency,
      receiptNumber: receiptNumber || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Category */}
        <div className="space-y-1 col-span-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EXPENSE_CATEGORIES).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Frequency */}
        <div className="space-y-1">
          <Label>Frequency</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as ExpenseFrequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(FREQUENCY_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Payment Method */}
        <div className="space-y-1">
          <Label>Payment Method</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-1 col-span-2">
          <Label>Description</Label>
          <Input
            placeholder="e.g., Monthly electricity bill"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        {/* Amount */}
        <div className="space-y-1">
          <Label>Amount (₹)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        {/* Date */}
        <div className="space-y-1">
          <Label>Date</Label>
          <Input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
          />
        </div>

        {/* Receipt / Reference */}
        <div className="space-y-1 col-span-2">
          <Label>Receipt / Reference No. (optional)</Label>
          <Input
            placeholder="Bill no. or reference"
            value={receiptNumber}
            onChange={(e) => setReceiptNumber(e.target.value)}
          />
        </div>

        {/* Tags */}
        <div className="space-y-1 col-span-2">
          <Label>Tags (optional, comma-separated)</Label>
          <Input
            placeholder="e.g., urgent, vendor-xyz"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Record Expense'}
      </Button>
    </form>
  );
}

// ── Pending Approval Row ──────────────────────────────────────────────────────

interface PendingRowProps {
  expense: Expense;
  onApprove: (id: string, action: 'approve' | 'reject') => void;
  approving: boolean;
}

function PendingApprovalRow({ expense, onApprove, approving }: PendingRowProps) {
  return (
    <TableRow>
      <TableCell className="text-xs">{expense.expenseDate}</TableCell>
      <TableCell className="text-xs">{EXPENSE_CATEGORIES[expense.category] ?? expense.category}</TableCell>
      <TableCell className="text-xs max-w-[160px] truncate">{expense.description}</TableCell>
      <TableCell className="text-xs font-semibold">{fmt(expense.amount)}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{(expense.enteredByUser as any)?.name ?? '—'}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs text-green-700 border-green-300"
            disabled={approving}
            onClick={() => onApprove(expense.id, 'approve')}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs text-red-700 border-red-300"
            disabled={approving}
            onClick={() => onApprove(expense.id, 'reject')}
          >
            <XCircle className="w-3 h-3 mr-1" />Reject
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { user } = useAuth();
  const { startDate: globalStartDate, endDate: globalEndDate } = useGlobalFilter();
  
  // useStations returns a NormalizedResponse<Station[]> union (success | failure).
  // Narrow to the success branch before accessing `.data` to satisfy TS typings.
  const stationsResponse = useStations().data;
  const stations: Station[] = stationsResponse?.success ? stationsResponse.data : [];
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [addOpen, setAddOpen] = useState(false);
  
  // Simplified filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'category' | 'station'>('category');
  const [selectedFilter, setSelectedFilter] = useState('');
  
  const queryClient = useQueryClient();

  // Resolve stationId
  const stationId = selectedStationId || stations[0]?.id || '';

  // Set default station
  if (stations.length > 0 && !selectedStationId && stations[0]?.id) {
    setSelectedStationId(stations[0].id);
  }

  const canManage = ['manager', 'owner', 'super_admin'].includes(user?.role ?? '');

  // ── Expense summary query (using global date filter) ──
  const summaryQuery = useQuery({
    queryKey: ['expense-summary', stationId, globalStartDate, globalEndDate],
    queryFn: () => {
      return apiClient.get<any>(
        `/stations/${stationId}/expense-summary?startDate=${globalStartDate}&endDate=${globalEndDate}`
      );
    },
    enabled: !!stationId,
  });

  // ── Expense list query (pending approvals) ──
  const pendingQuery = useQuery({
    queryKey: ['expenses-pending', stationId],
    queryFn: () =>
      apiClient.get<any>(`/stations/${stationId}/expenses?approvalStatus=pending&limit=50`),
    enabled: !!stationId && canManage,
  });

  // ── All expenses for the period (using global date filter) ──
  const expensesQuery = useQuery({
    queryKey: ['expenses-list', stationId, globalStartDate, globalEndDate],
    queryFn: () => {
      return apiClient.get<any>(
        `/stations/${stationId}/expenses?startDate=${globalStartDate}&endDate=${globalEndDate}&limit=100`
      );
    },
    enabled: !!stationId,
  });

  // ── Approve mutation ──
  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      apiClient.patch(`/expenses/${id}/approve`, { action }),
    onSuccess: (_, { action }) => {
      toast.success(`Expense ${action === 'approve' ? 'approved' : 'rejected'}`);
      queryClient.invalidateQueries({ queryKey: ['expenses-pending', stationId] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary', stationId] });
      queryClient.invalidateQueries({ queryKey: ['expenses-list', stationId] });
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to process approval');
    },
  });

  // ── Bulk approve mutation ──
  const bulkApproveMutation = useMutation({
    mutationFn: ({ mode }: { mode: 'safe' | 'all' }) =>
      apiClient.patch(`/stations/${stationId}/expenses/bulk-approve`, {
        approvalMode: mode,
        skipExpenseIds: []
      }),
    onSuccess: (data: any) => {
      toast.success(data?.data?.message || `Approved ${data?.data?.approved} expense(s)`);
      if (data?.data?.skipped > 0) {
        toast.info(`${data.data.skipped} expense(s) skipped for manual review`);
      }
      queryClient.invalidateQueries({ queryKey: ['expenses-pending', stationId] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary', stationId] });
      queryClient.invalidateQueries({ queryKey: ['expenses-list', stationId] });
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to bulk approve expenses');
    },
  });

  const summary = (summaryQuery.data as any)?.data;
  const pending: Expense[] = (pendingQuery.data as any)?.data?.expenses ?? [];
  const allExpenses: Expense[] = (expensesQuery.data as any)?.data?.expenses ?? [];

  // Filter expenses by search and single filter
  const filteredExpenses = allExpenses.filter((exp) => {
    // Search filter (description, amount, date)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesDescription = (exp.description || '').toLowerCase().includes(query);
      const matchesAmount = exp.amount.toString().includes(query);
      const matchesDate = (exp.expenseDate || '').includes(query);
      if (!matchesDescription && !matchesAmount && !matchesDate) {
        return false;
      }
    }

    // Single filter (category or station)
    if (selectedFilter) {
      if (filterType === 'category' && exp.category !== selectedFilter) {
        return false;
      }
      if (filterType === 'station' && exp.stationId !== selectedFilter) {
        return false;
      }
    }

    return true;
  });

  const expenses = filteredExpenses;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['expense-summary', stationId] });
    queryClient.invalidateQueries({ queryKey: ['expenses-list', stationId] });
    queryClient.invalidateQueries({ queryKey: ['expenses-pending', stationId] });
    setAddOpen(false);
  };

  return (
    <>
      <DateRangeFilterToolbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 pt-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <TrendingDown className="w-7 h-7 text-red-500" />
              Expenses
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track and manage your station expenses
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Station picker */}
            {stations.length > 1 && (
              <Select value={selectedStationId} onValueChange={setSelectedStationId}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Station" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* Add expense */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />Record New Expense
                  </DialogTitle>
                </DialogHeader>
                {stationId && (
                  <AddExpenseForm stationId={stationId} onSuccess={invalidateAll} />
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Combined Summary Card */}
        <Card className="bg-white border-blue-200 dark:bg-blue-950/20 shadow-sm">
          <CardContent className="py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground">Stations</div>
                <div className="text-xl font-bold">{stations.length}</div>
                <div className="text-xs text-muted-foreground">{stations.filter(s => s.isActive).length} active</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Employees</div>
                <div className="text-xl font-bold">{summary?.employeeCount ?? '—'}</div>
                <div className="text-xs text-muted-foreground">Across all stations</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Today's Sales</div>
                <div className="text-xl font-bold">{summary?.todaySales ? fmt(summary.todaySales) : '—'}</div>
                <div className="text-xs text-muted-foreground">Combined total</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Month Sales</div>
                <div className="text-xl font-bold">{summary?.monthSales ? fmt(summary.monthSales) : '—'}</div>
                <div className="text-xs text-muted-foreground">Current month</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Simple Filter: Search + Category/Station */}
        <ExpenseSimpleFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
          categoryOptions={Object.entries(EXPENSE_CATEGORIES).map(([v, l]) => ({
            value: v,
            label: l,
          }))}
          stationOptions={stations.map((s) => ({
            value: s.id,
            label: s.name,
          }))}
        />

      {/* Expense List */}
      {canManage && pending.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <CardTitle className="text-base flex items-center gap-2 text-yellow-700">
                <Clock className="w-4 h-4" />
                Pending Approvals ({pending.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 text-green-700 border-green-300 hover:bg-green-50"
                  disabled={bulkApproveMutation.isPending}
                  onClick={() => bulkApproveMutation.mutate({ mode: 'safe' })}
                  title="Auto-approve low-risk expenses (₹0-₹10k)"
                >
                  {bulkApproveMutation.isPending ? 'Approving…' : 'Safe Auto-Approve'}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="text-xs h-7"
                  disabled={bulkApproveMutation.isPending}
                  onClick={() => {
                    if (confirm(`Approve all ${pending.length} pending expense(s)? This action cannot be undone.`)) {
                      bulkApproveMutation.mutate({ mode: 'all' });
                    }
                  }}
                >
                  {bulkApproveMutation.isPending ? 'Approving…' : 'Approve All'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-yellow-600 mt-2">
              💡 <strong>Safe Auto-Approve</strong> will approve expenses ≤₹10,000 or common categories (Cleaning, Supplies, Maintenance). 
              Review high-value expenses manually.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Entered By</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map(exp => (
                  <PendingApprovalRow
                    key={exp.id}
                    expense={exp}
                    approving={approveMutation.isPending}
                    onApprove={(id, action) => approveMutation.mutate({ id, action })}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards (using global date filter) */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Approved Total</p>
              <p className="text-xl font-bold text-green-600">{fmt(summary.approvedTotal || 0)}</p>
            </CardContent>
          </Card>
          {(summary.pendingCount ?? 0) > 0 && (
            <Card className="border-yellow-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">⏳ Awaiting Review</p>
                <p className="text-xl font-bold text-yellow-600">{fmt(summary.pendingAmount || 0)}</p>
                <p className="text-xs text-yellow-600">{summary.pendingCount} pending</p>
                <p className="text-xs text-muted-foreground mt-1">Entered by staff • Not counted yet</p>
              </CardContent>
            </Card>
          )}
          {summary.byFrequency?.map((f: any) => (
            <Card key={f.frequency}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{FREQUENCY_LABELS[f.frequency as ExpenseFrequency] ?? f.frequency}</p>
                <p className="text-lg font-bold">{fmt(f.total)}</p>
                <p className="text-xs text-muted-foreground">{f.count} entries</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Category Breakdown */}
      {summary?.byCategory?.length > 0 && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {summary.byCategory.map((c: any) => (
              <div key={c.category} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div>
                  <p className="text-sm font-medium">{c.label ?? EXPENSE_CATEGORIES[c.category] ?? c.category}</p>
                  <p className="text-xs text-muted-foreground">{c.count} entries</p>
                </div>
                <p className="font-semibold text-red-600">{fmt(c.total)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Expense List */}
        <div className="mt-4">
          <ExpenseTable expenses={expenses} loading={expensesQuery.isLoading} />
        </div>
      </div>
    </>
    );
}

// ── Expense Table ─────────────────────────────────────────────────────────────

function ExpenseTable({ expenses, loading }: { expenses: Expense[]; loading: boolean }) {
  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading expenses…</p>;
  }
  if (!expenses.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <IndianRupee className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">No expenses recorded for this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs">Freq</TableHead>
              <TableHead className="text-xs">Amount</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map(exp => {
              const status = (exp.approvalStatus ?? 'auto_approved') as ExpenseApprovalStatus;
              return (
                <TableRow key={exp.id}>
                  <TableCell className="text-xs">{exp.expenseDate}</TableCell>
                  <TableCell className="text-xs">{EXPENSE_CATEGORIES[exp.category] ?? exp.category}</TableCell>
                  <TableCell className="text-xs max-w-[180px] truncate">{exp.description}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {FREQUENCY_LABELS[(exp.frequency as ExpenseFrequency) ?? 'one_time']}
                  </TableCell>
                  <TableCell className="text-xs font-semibold">{fmt(exp.amount)}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs gap-1 ${APPROVAL_COLOR[status] ?? ''}`}>
                      {APPROVAL_ICON[status]}
                      {APPROVAL_STATUS_LABELS[status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
