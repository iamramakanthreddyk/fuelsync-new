/**
 * Daily Settlement Page  Simplified
 *
 * Flow:
 * 1. Pick date (defaults to today)
 * 2. Review employee readings  all unsettled ones are pre-selected
 * 3. Enter the cash (and optionally online/credit) you actually collected
 * 4. See the variance instantly
 * 5. Hit "Confirm Settlement"
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { safeToFixed } from '@/lib/format-utils';
import { ArrowLeft, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import type { PaymentSubBreakdown, UpiSubType, CardSubType, OilCompanySubType } from '@/types/finance';

//  Types 

interface DailySalesData {
  date: string;
  stationId: string;
  stationName: string;
  totalSaleValue: number;
  totalLiters: number;
  expectedCash: number;
  paymentSplit: { cash: number; online: number; credit: number };
  readings: { id: string; fuelType: string; liters: number; saleValue: number }[];
}

interface ReadingForSettlement {
  id: string;
  nozzleNumber: number;
  fuelType: string;
  openingReading: number;
  closingReading: number;
  litresSold: number;
  saleValue: number;
  // legacy flat fields (may be absent in newer API responses)
  cashAmount?: number;
  onlineAmount?: number;
  creditAmount?: number;
  recordedBy: { id: string; name: string } | null;
  recordedAt: string;
  status?: string;
  settlementId: string | null;
  carriedForwardFrom?: string | null;
  linkedSettlement: { id: string; date: string; isFinal: boolean } | null;
  transaction?: {
    id: string;
    transactionDate: string;
    status: string;
    createdBy: string;
    paymentBreakdown: { cash: number; online: number; credit: number };
  } | null;
}

interface ReadingsForSettlementResponse {
  date: string;
  stationId: string;
  unlinked: {
    count: number;
    readings: ReadingForSettlement[];
    totals: { cash: number; online: number; credit: number; litres: number; value: number };
  };
  linked: { count: number; readings: ReadingForSettlement[] };
  allReadingsCount: number;
}

//  Helpers 

/** Deduplicate payments: when employee submits a batch, every reading stores the
 *  full transaction total. Count each unique transaction only once.
 *  Supports both new (transaction.paymentBreakdown) and legacy (cashAmount) shapes. */
function deduplicatePayments(readings: ReadingForSettlement[]) {
  const seenTxn = new Set<string>();
  const seen = new Set<string>();
  return readings.reduce(
    (acc, r) => {
      // Prefer nested transaction breakdown (new API shape)
      if (r.transaction?.paymentBreakdown) {
        const txId = r.transaction.id;
        if (!seenTxn.has(txId)) {
          seenTxn.add(txId);
          acc.cash += r.transaction.paymentBreakdown.cash || 0;
          acc.online += r.transaction.paymentBreakdown.online || 0;
          acc.credit += r.transaction.paymentBreakdown.credit || 0;
        }
      } else {
        // Legacy flat fields
        const cash = r.cashAmount || 0;
        const online = r.onlineAmount || 0;
        const credit = r.creditAmount || 0;
        const emp = r.recordedBy?.id || 'unknown';
        if (cash > 0 || online > 0 || credit > 0) {
          const key = `${emp}|${cash.toFixed(2)}|${online.toFixed(2)}|${credit.toFixed(2)}`;
          if (!seen.has(key)) {
            seen.add(key);
            acc.cash += cash;
            acc.online += online;
            acc.credit += credit;
          }
        } else {
          acc.cash += r.saleValue; // legacy: no breakdown  treat as cash
        }
      }
      acc.litres += r.litresSold;
      acc.value += r.saleValue;
      return acc;
    },
    { cash: 0, online: 0, credit: 0, litres: 0, value: 0 }
  );
}

const fmt = (n: number) =>
  n >= 100000 ? `${safeToFixed(n / 100000, 1)}L` : `${safeToFixed(n, 0)}`;

const fuelLabel: Record<string, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  cng: 'CNG',
  premium_petrol: 'Premium',
};

//  Component 

export default function DailySettlement() {
  const navigate = useNavigate();
  const { stationId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actualCash, setActualCash] = useState<number>(0);
  const [actualOnline, setActualOnline] = useState<number>(0);
  const [onlineBreakdown, setOnlineBreakdown] = useState<PaymentSubBreakdown | null>(null);
  const [actualCredit, setActualCredit] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  //  Fetch daily sales summary 
  const { data: dailySales, isLoading: salesLoading } = useQuery({
    queryKey: ['daily-sales', stationId, selectedDate],
    queryFn: async () => {
      if (!stationId) return null;
      const res = await apiClient.get<{ success: boolean; data: DailySalesData }>(
        `/stations/${stationId}/daily-sales?date=${selectedDate}`
      );
      return res?.data || null;
    },
    enabled: !!stationId,
  });

  //  Fetch unsettled / settled readings 
  const { data: readingsData, isLoading: readingsLoading } = useQuery({
    queryKey: ['readings-for-settlement', stationId, selectedDate],
    queryFn: async () => {
      if (!stationId) return null;
      try {
        const res = await apiClient.get<{ success: boolean; data: ReadingsForSettlementResponse }>(
          `/stations/${stationId}/readings-for-settlement?date=${selectedDate}`
        );
        return res?.data || null;
      } catch {
        return null;
      }
    },
    enabled: !!stationId,
    retry: false,
  });

  // Auto-select all unsettled readings and pre-fill owner inputs from employee totals
  useEffect(() => {
    if (readingsData?.unlinked?.readings) {
      setSelectedIds(readingsData.unlinked.readings.map((r) => r.id));
      // Pre-populate owner's confirmation inputs with employee-reported totals
      const t = readingsData.unlinked.totals;
      if (t) {
        setActualCash(t.cash || 0);
        setActualOnline(t.online || 0);
        setActualCredit(t.credit || 0);
      }
    } else {
      setSelectedIds([]);
    }
  }, [readingsData]);

  // Reset inputs when date changes
  useEffect(() => {
    setActualCash(0);
    setActualOnline(0);
    setOnlineBreakdown(null);
    setActualCredit(0);
    setNotes('');
  }, [selectedDate]);

  //  Derived values 
  const allReadings = [
    ...(readingsData?.unlinked.readings ?? []),
    ...(readingsData?.linked.readings ?? []),
  ];
  const selected = allReadings.filter((r) => selectedIds.includes(r.id));
  const expected = deduplicatePayments(selected);
  const expectedTotal = expected.cash + expected.online + expected.credit;
  const actualTotal = actualCash + actualOnline + actualCredit;
  const totalVariance = expectedTotal - actualTotal;
  const unlinkedIds = (readingsData?.unlinked.readings ?? []).map((r) => r.id);
  const allUnlinkedSelected =
    unlinkedIds.length > 0 && unlinkedIds.every((id) => selectedIds.includes(id));

  //  Submit 
  const submitMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return apiClient.post(`/stations/${stationId}/settlements`, payload);
    },
    onSuccess: () => {
      toast({ title: 'Settlement saved', variant: 'success' });
      setActualCash(0);
      setActualOnline(0);
      setOnlineBreakdown(null);
      setActualCredit(0);
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['daily-sales'] });
      queryClient.invalidateQueries({ queryKey: ['readings-for-settlement'] });
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
    },
    onError: (err) => {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save settlement',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (selectedIds.length === 0) {
      toast({ title: 'Select at least one reading', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    submitMutation.mutate(
      {
        date: selectedDate,
        stationId,
        expectedCash: expected.cash,
        actualCash,
        online: actualOnline,
        credit: actualCredit,
        notes,
        readingIds: selectedIds,
        isFinal: true,
        ...(onlineBreakdown ? { paymentSubBreakdown: onlineBreakdown } : {}),
      },
      { onSettled: () => setSubmitting(false) }
    );
  };

  const toggleReading = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleAllUnlinked = () => {
    if (allUnlinkedSelected) {
      setSelectedIds((prev) => prev.filter((id) => !unlinkedIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...unlinkedIds])]);
    }
  };

  if (!stationId) return null;

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-5">

      {/*  Header  */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">Daily Settlement</h1>
          {dailySales?.stationName && (
            <p className="text-sm text-muted-foreground truncate">{dailySales.stationName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-36 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/settlements?stationId=${stationId}&date=${selectedDate}`)}
            className="text-xs"
          >
            View history
          </Button>
        </div>
      </div>

      {/*  Loading / empty  */}
      {salesLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Loading</CardContent>
        </Card>
      ) : !dailySales ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No sales data for {selectedDate}
          </CardContent>
        </Card>
      ) : (
        <>
          {/*  2-number summary  */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold text-green-600">{fmt(dailySales.totalSaleValue)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {safeToFixed(dailySales.totalLiters, 0)} L
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Cash Expected</p>
                <p className="text-2xl font-bold text-orange-600">{fmt(dailySales.expectedCash)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">from employee entries</p>
              </CardContent>
            </Card>
          </div>

          {/*  Employee readings  */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Employee Entries</CardTitle>
                {unlinkedIds.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={toggleAllUnlinked} className="text-xs h-7">
                    {allUnlinkedSelected ? 'Deselect all' : 'Select all'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {readingsLoading && (
                <p className="text-sm text-muted-foreground text-center py-6">Loading entries</p>
              )}

              {!readingsLoading && unlinkedIds.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {(readingsData?.linked.count ?? 0) > 0
                    ? 'All readings for this date are already settled.'
                    : 'No employee entries found for this date.'}
                </p>
              )}

              {/* Unsettled readings */}
              {(readingsData?.unlinked.readings ?? []).map((r) => {
                const checked = selectedIds.includes(r.id);
                return (
                  <div
                    key={r.id}
                    onClick={() => toggleReading(r.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleReading(r.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {fuelLabel[r.fuelType] ?? r.fuelType}  Nozzle #{r.nozzleNumber}
                        </span>
                        {r.recordedBy && (
                          <span className="text-xs text-muted-foreground">
                             {r.recordedBy.name}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {safeToFixed(r.litresSold, 1)} L
                        {(r.cashAmount ?? 0) > 0 && `  Cash ${fmt(r.cashAmount!)}`}
                        {(r.onlineAmount ?? 0) > 0 && `  Online ${fmt(r.onlineAmount!)}`}
                        {(r.creditAmount ?? 0) > 0 && `  Credit ${fmt(r.creditAmount!)}`}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-green-700 shrink-0">
                      {fmt(r.saleValue)}
                    </span>
                  </div>
                );
              })}

              {/* Already settled (collapsed, read-only) */}
              {(readingsData?.linked.count ?? 0) > 0 && (
                <details className="mt-1">
                  <summary className="text-xs text-muted-foreground cursor-pointer select-none py-1">
                    {readingsData!.linked.count} reading(s) already settled  view
                  </summary>
                  <div className="mt-2 space-y-1">
                    {readingsData!.linked.readings.map((r) => (
                      <div
                        key={r.id}
                        className="flex justify-between p-2 rounded-lg border border-gray-100 bg-gray-50 text-xs text-muted-foreground"
                      >
                        <span>
                          {fuelLabel[r.fuelType] ?? r.fuelType}  Nozzle #{r.nozzleNumber}
                          {r.recordedBy && `  ${r.recordedBy.name}`}
                        </span>
                        <span>{fmt(r.saleValue)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Selection totals strip */}
              {selectedIds.length > 0 && (
                <div className="mt-2 p-2.5 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-800">
                  <span className="font-semibold">{selectedIds.length} selected</span>
                  {'  '}Cash {fmt(expected.cash)}
                  {expected.online > 0 && <>  Online {fmt(expected.online)}</>}
                  {expected.credit > 0 && <>  Credit {fmt(expected.credit)}</>}
                </div>
              )}
            </CardContent>
          </Card>

          {/*  Confirm Settlement  */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Confirm Settlement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Employee-reported payment breakdown banner */}
              {selectedIds.length > 0 && (
                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 space-y-2">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Employee Reported</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Cash</p>
                      <p className="text-base font-bold text-blue-800">{fmt(expected.cash)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Online</p>
                      <p className="text-base font-bold text-blue-800">{fmt(expected.online)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Credit</p>
                      <p className="text-base font-bold text-blue-800">{fmt(expected.credit)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 text-center">
                    Total: {fmt(expected.cash + expected.online + expected.credit)}
                    {expected.litres > 0 && ` · ${safeToFixed(expected.litres, 0)} L`}
                  </p>
                </div>
              )}

              {/* Owner confirmation inputs */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Verify & adjust if needed, then confirm:
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Cash collected</Label>
                    <Input
                      type="number"
                      step="1"
                      value={actualCash || ''}
                      onChange={(e) => setActualCash(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Online (UPI / card)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={actualOnline || ''}
                      onChange={(e) => setActualOnline(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Credit given</Label>
                    <Input
                      type="number"
                      step="1"
                      value={actualCredit || ''}
                      onChange={(e) => setActualCredit(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                {/* Online Payment Breakdown */}
                {actualOnline > 0 && (
                  <Collapsible defaultOpen={!!onlineBreakdown} className="mt-3">
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-between h-auto p-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          if (!onlineBreakdown) {
                            setOnlineBreakdown({
                              cash: 0,
                              upi: {},
                              card: {},
                              oil_company: {},
                              credit: 0
                            });
                          }
                        }}
                      >
                        <span>{onlineBreakdown ? 'Collapse' : 'Add'} payment method breakdown</span>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-2 border-t border-blue-200 mt-2">
                      {onlineBreakdown && (
                        <div className="bg-blue-50 p-2 rounded space-y-2">
                          {/* UPI Section */}
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-blue-700">UPI Payments</Label>
                            {(['gpay', 'phonepe', 'paytm', 'amazon_pay', 'cred', 'bhim', 'other_upi'] as const).map((upi) => (
                              <div key={upi} className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground flex-1">
                                  {upi === 'gpay' ? 'Google Pay' : upi === 'phonepe' ? 'PhonePe' : upi === 'paytm' ? 'Paytm' : upi === 'amazon_pay' ? 'Amazon Pay' : upi === 'cred' ? 'CRED' : upi === 'bhim' ? 'BHIM' : 'Other UPI'}
                                </Label>
                                <div className="relative w-24">
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={onlineBreakdown.upi?.[upi] || ''}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setOnlineBreakdown({
                                        ...onlineBreakdown,
                                        upi: { ...onlineBreakdown.upi, [upi]: val }
                                      });
                                    }}
                                    className="pl-5 w-full h-6 text-xs border border-blue-300 rounded"
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Card Section */}
                          <div className="space-y-1 border-t border-blue-200 pt-2">
                            <Label className="text-xs font-semibold text-blue-700">Card Payments</Label>
                            {(['debit_card', 'credit_card'] as const).map((card) => (
                              <div key={card} className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground flex-1">
                                  {card === 'debit_card' ? 'Debit Card' : 'Credit Card'}
                                </Label>
                                <div className="relative w-24">
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={onlineBreakdown.card?.[card] || ''}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setOnlineBreakdown({
                                        ...onlineBreakdown,
                                        card: { ...onlineBreakdown.card, [card]: val }
                                      });
                                    }}
                                    className="pl-5 w-full h-6 text-xs border border-blue-300 rounded"
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Oil Company Section */}
                          <div className="space-y-1 border-t border-blue-200 pt-2">
                            <Label className="text-xs font-semibold text-blue-700">Oil Company Payments</Label>
                            {(['hp_pay', 'iocl_card', 'bpcl_smartfleet', 'essar_fleet', 'reliance_fleet', 'other_oil_company'] as const).map((oil) => (
                              <div key={oil} className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground flex-1">
                                  {oil === 'hp_pay' ? 'HP Pay' : oil === 'iocl_card' ? 'IOCL Card' : oil === 'bpcl_smartfleet' ? 'BPCL SmartFleet' : oil === 'essar_fleet' ? 'Essar Fleet' : oil === 'reliance_fleet' ? 'Reliance Fleet' : 'Other Oil Co.'}
                                </Label>
                                <div className="relative w-24">
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={onlineBreakdown.oil_company?.[oil] || ''}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setOnlineBreakdown({
                                        ...onlineBreakdown,
                                        oil_company: { ...onlineBreakdown.oil_company, [oil]: val }
                                      });
                                    }}
                                    className="pl-5 w-full h-6 text-xs border border-blue-300 rounded"
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>

              {/* Variance — compares sum of all payment types */}
              {selectedIds.length > 0 && actualTotal > 0 && (
                <div
                  className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                    Math.abs(totalVariance) < 1
                      ? 'border-green-300 bg-green-50'
                      : totalVariance > 0
                      ? 'border-red-300 bg-red-50'
                      : 'border-yellow-300 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {Math.abs(totalVariance) < 1 ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                    )}
                    <div>
                      <span className="text-sm font-medium">
                        {Math.abs(totalVariance) < 1
                          ? 'All amounts match'
                          : totalVariance > 0
                          ? 'Shortfall'
                          : 'Surplus'}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Expected {fmt(expectedTotal)} · You entered {fmt(actualTotal)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-lg font-bold ${
                      Math.abs(totalVariance) < 1
                        ? 'text-green-600'
                        : totalVariance > 0
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {totalVariance > 0 ? '-' : totalVariance < 0 ? '+' : ''}
                    {fmt(Math.abs(totalVariance))}
                  </span>
                </div>
              )}

              {/* Notes */}
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any remarks"
                  className="mt-1"
                />
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={
                  submitting || submitMutation.isPending || selectedIds.length === 0 || actualTotal === 0
                }
                size="lg"
                className="w-full text-base py-5"
              >
                {submitting || submitMutation.isPending
                  ? 'Saving…'
                  : selectedIds.length === 0
                  ? 'Select readings first'
                  : actualTotal === 0
                  ? 'Enter amounts to confirm'
                  : 'Confirm Settlement'}
              </Button>

              {selectedIds.length === 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  Tick the employee entries you want to include above
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
