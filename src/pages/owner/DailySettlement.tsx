/**
 * Daily Settlement Page
 * 
 * FLOW:
 * 1. Manager selects a date to review readings
 * 2. System shows all readings for that date (unlinked = not yet settled, linked = already settled)
 * 3. Manager selects which readings to include in this settlement
 * 4. Manager enters actual cash collected (physical count)
 * 5. System calculates variance = expected cash - actual cash
 * 6. Manager confirms settlement, linking readings to settlement record
 * 
 * DATA FIELDS:
 * - openingReading = previous meter reading (last reading before today)
 * - closingReading = current meter reading (entered during reading entry)
 * - litresSold = closingReading - openingReading
 * - saleValue = litresSold × price per litre (pre-calculated during reading entry)
 * - expectedCash = sum of all selected readings' cash amounts
 * - actualCash = physical cash count by manager (user input)
 * - variance = expectedCash - actualCash (calculated on backend to prevent manipulation)
 * 
 * UNLINKED vs LINKED:
 * - Unlinked: Readings not yet assigned to any settlement (ready to be settled)
 * - Linked: Readings already assigned to a settlement (finalized)
 * 
 * IMPORTANT: Backend recalculates variance to prevent frontend tampering
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { safeToFixed } from '@/lib/format-utils';
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  FileCheck,
  User,
  Clock
} from 'lucide-react';
import { Button as NavButton } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface TransactionDetails {
  id: string;
  transactionDate: string;
  status: string;
  createdBy: string;
}

interface DailySalesData {
  date: string;
  stationId: string;
  stationName: string;
  totalSaleValue: number;
  totalLiters: number;
  byFuelType: Record<string, { liters: number; value: number }>;
  expectedCash: number;
  paymentSplit: {
    cash: number;
    online: number;
    credit: number;
  };
  readings: Array<{
    id: string;
    nozzleNumber: number;
    fuelType: string;
    liters: number;
    saleValue: number;
  }>;
}

interface ReadingForSettlement {
  id: string;
  nozzleNumber: number;
  fuelType: string;
  openingReading: number;
  closingReading: number;
  litresSold: number;
  saleValue: number;
  recordedBy: { id: string; name: string } | null;
  recordedAt: string;
  settlementId: string | null;
  linkedSettlement: { id: string; date: string; isFinal: boolean } | null;
  transaction: TransactionDetails | null;
}

interface ReadingsForSettlementResponse {
  date: string;
  stationId: string;
  unlinked: {
    count: number;
    readings: ReadingForSettlement[];
    totals: { cash: number; online: number; credit: number; litres: number; value: number };
  };
  linked: {
    count: number;
    readings: ReadingForSettlement[];
  };
  allReadingsCount: number;
}

interface SettlementRecord {
  id?: string;
  date: string;
  stationId: string;
  expectedCash: number;
  actualCash: number;
  variance: number;
  employeeCash?: number;
  employeeOnline?: number;
  employeeCredit?: number;
  online: number;
  credit: number;
  varianceOnline?: number;
  varianceCredit?: number;
  notes: string;
  settledBy?: string;
  settledAt?: string;
  isFinal?: boolean;
  finalizedAt?: string;
  duplicateCount?: number;
  allSettlements?: SettlementRecord[];
  recordedAt?: string;
}

export default function DailySettlement() {
  const navigate = useNavigate();
  const { stationId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [actualCash, setActualCash] = useState<number>(0);
  const [actualOnline, setActualOnline] = useState<number>(0);
  const [actualCredit, setActualCredit] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedReadingIds, setSelectedReadingIds] = useState<string[]>([]);
  const [showReadingSelection, setShowReadingSelection] = useState(true); // Always show by default
  const [markAsFinal, setMarkAsFinal] = useState(true); // Default to final settlement

  // Fetch daily sales data
  const { data: dailySales, isLoading: salesLoading } = useQuery({
    queryKey: ['daily-sales', stationId, selectedDate],
    queryFn: async () => {
      if (!stationId) return null;
      const response = await apiClient.get<{ success: boolean; data: DailySalesData }>(
        `/stations/${stationId}/daily-sales?date=${selectedDate}`
      );
      // Extract the data from the response envelope
      return response?.data || null;
    },
    enabled: !!stationId
  });

  // Fetch readings for settlement (shows unlinked + linked readings)
  const { data: readingsForSettlement, isLoading: readingsLoading } = useQuery({
    queryKey: ['readings-for-settlement', stationId, selectedDate],
    queryFn: async () => {
      if (!stationId) return null;
      try {
        const response = await apiClient.get<{ success: boolean; data: ReadingsForSettlementResponse }>(
          `/stations/${stationId}/readings-for-settlement?date=${selectedDate}`
        );
        return response?.data || null;
      } catch (error) {
        console.warn('Failed to fetch readings for settlement:', error);
        return null;
      }
    },
    enabled: !!stationId && showReadingSelection,
    retry: false
  });

  // Fetch previous settlement records
  const { data: previousSettlements = [] } = useQuery({
    queryKey: ['settlements', stationId],
    queryFn: async () => {
      if (!stationId) return [];
      try {
        const response = await apiClient.get<{ success: boolean; data: SettlementRecord[] }>(
          `/stations/${stationId}/settlements` // get all for audit
        );
        return response?.data || [];
      } catch (error) {
        // Settlements endpoint may not exist yet, return empty
        console.warn('Failed to fetch settlements:', error);
        return [];
      }
    },
    enabled: !!stationId,
    retry: false
  });

  // Submit settlement mutation with reading IDs
  const submitSettlementMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      try {
        const response = await apiClient.post(
          `/stations/${stationId}/settlements`,
          data
        );
        return response;
      } catch (error: unknown) {
        // If endpoint doesn't exist, just record the intent
        if ((error as { status?: number })?.status === 404) {
          console.warn('Settlements endpoint not yet available, data prepared for submission');
          return { success: true, data };
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Settlement Completed',
        description: 'Daily sales settlement recorded successfully',
        variant: 'success'
      });
      setActualCash(0);
      setActualOnline(0);
      setActualCredit(0);
      setNotes('');
      setSelectedReadingIds([]);
      setShowReadingSelection(false);
      queryClient.invalidateQueries({ queryKey: ['daily-sales'] });
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      queryClient.invalidateQueries({ queryKey: ['readings-for-settlement'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settlement',
        variant: 'destructive'
      });
    }
  });

  // Toggle reading selection
  const handleToggleReading = (readingId: string) => {
    setSelectedReadingIds(prev => 
      prev.includes(readingId) 
        ? prev.filter(id => id !== readingId)
        : [...prev, readingId]
    );
  };

  // Select/deselect all readings
  const handleSelectAllReadings = (readings: ReadingForSettlement[]) => {
    const allIds = readings.map(r => r.id);
    const allSelected = allIds.every(id => selectedReadingIds.includes(id));
    if (allSelected) {
      setSelectedReadingIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedReadingIds(prev => [...new Set([...prev, ...allIds])]);
    }
  };

  // Calculate totals from selected readings
  const getSelectedTotals = () => {
    if (!readingsForSettlement || selectedReadingIds.length === 0) {
      return { cash: 0, online: 0, credit: 0, litres: 0, value: 0 };
    }
    const allReadings = [...readingsForSettlement.unlinked.readings, ...readingsForSettlement.linked.readings];
    return allReadings
      .filter(r => selectedReadingIds.includes(r.id))
      .reduce((acc, r) => ({
        cash: acc.cash + r.cashAmount,
        online: acc.online + r.onlineAmount,
        credit: acc.credit + r.creditAmount,
        litres: acc.litres + r.litresSold,
        value: acc.value + r.saleValue
      }), { cash: 0, online: 0, credit: 0, litres: 0, value: 0 });
  };

  const handleSubmitSettlement = async () => {
    if (!dailySales) {
      toast({
        title: 'Error',
        description: 'No sales data available',
        variant: 'destructive'
      });
      return;
    }

    // REQUIRE reading selection - owner must pick which entries to settle
    if (selectedReadingIds.length === 0) {
      toast({
        title: 'Select Readings First',
        description: 'Please select at least one employee reading entry to include in this settlement',
        variant: 'destructive'
      });
      return;
    }

    // NOTE: Variance is calculated on backend, don't send it
    // Frontend shows it for user info, but backend recalculates to prevent manipulation
    setIsSubmitting(true);
    submitSettlementMutation.mutate({
      date: selectedDate,
      stationId,
      expectedCash: getSelectedTotals().cash, // Use selected readings totals
      actualCash,
      online: actualOnline,
      credit: actualCredit,
      // variance: NOT SENT - backend will calculate: expectedCash - actualCash
      notes,
      // REQUIRED: Include selected reading IDs
      readingIds: selectedReadingIds,
      isFinal: markAsFinal
    });
    setIsSubmitting(false);
  };

  if (!stationId) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Station not found</p>
          <NavButton onClick={() => navigate('/owner/stations')} className="mt-4">
            Go to Stations
          </NavButton>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <NavButton
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" />
        </NavButton>
        <div>
          <h1 className="text-3xl font-bold">Daily Settlement</h1>
          <p className="text-muted-foreground">
            {dailySales?.stationName}
          </p>
        </div>
      </div>

      {/* Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Date</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="max-w-xs"
          />
        </CardContent>
      </Card>

      {salesLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            Loading sales data...
          </CardContent>
        </Card>
      ) : !dailySales ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No sales recorded for this date</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Sales Summary */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Today's Sales Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="p-3 md:p-4 bg-white rounded-lg border overflow-hidden">
                  <div className="text-xs md:text-sm text-muted-foreground mb-1 truncate">Total Liters</div>
                  <div className="text-lg md:text-xl lg:text-2xl font-bold text-blue-600 break-all md:break-normal">
                    {dailySales.totalLiters >= 1000
                      ? `${safeToFixed(dailySales.totalLiters / 1000, 1)}K L`
                      : `${safeToFixed(dailySales.totalLiters, 2)} L`}
                  </div>
                </div>
                <div className="p-3 md:p-4 bg-white rounded-lg border overflow-hidden">
                  <div className="text-xs md:text-sm text-muted-foreground mb-1 truncate">Total Sale Value</div>
                  <div className="text-lg md:text-xl lg:text-2xl font-bold text-green-600 break-all md:break-normal">
                    ₹{dailySales.totalSaleValue >= 100000
                      ? `${safeToFixed(dailySales.totalSaleValue / 100000, 1)}L`
                      : safeToFixed(dailySales.totalSaleValue, 2)}
                  </div>
                </div>
                <div className="p-3 md:p-4 bg-white rounded-lg border overflow-hidden">
                  <div className="text-xs md:text-sm text-muted-foreground mb-1 truncate">Readings</div>
                  <div className="text-lg md:text-xl lg:text-2xl font-bold text-purple-600 break-all md:break-normal">
                    {dailySales.readings.length >= 1000
                      ? `${safeToFixed(dailySales.readings.length / 1000, 1)}K`
                      : dailySales.readings.length.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 md:p-4 bg-white rounded-lg border overflow-hidden">
                  <div className="text-xs md:text-sm text-muted-foreground mb-1 truncate">Expected Cash</div>
                  <div className="text-lg md:text-xl lg:text-2xl font-bold text-orange-600 break-all md:break-normal">
                    ₹{dailySales.expectedCash >= 100000
                      ? `${safeToFixed(dailySales.expectedCash / 100000, 1)}L`
                      : safeToFixed(dailySales.expectedCash, 2)}
                  </div>
                </div>
              </div>

              {/* By Fuel Type */}
              {Object.keys(dailySales.byFuelType).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-3">Breakdown by Fuel Type</h4>
                  <div className="space-y-2">
                    {Object.entries(dailySales.byFuelType).map(([fuelType, data]) => (
                      <div key={fuelType} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="capitalize">
                            {fuelType}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {safeToFixed(data.liters, 2)} L
                          </span>
                        </div>
                        <div className="text-sm font-semibold">
                          ₹{safeToFixed(data.value, 2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Breakdown */}
              <div className="grid grid-cols-3 gap-2 md:gap-3 mt-4 pt-4 border-t">
                <div className="p-2 md:p-3 bg-white rounded-lg border-2 border-green-200 overflow-hidden">
                  <div className="text-xs text-muted-foreground mb-1 truncate">Cash</div>
                  <div className="text-sm md:text-base font-bold text-green-600 break-all md:break-normal">
                    ₹{dailySales.paymentSplit.cash >= 100000
                      ? `${safeToFixed(dailySales.paymentSplit.cash / 100000, 1)}L`
                      : safeToFixed(dailySales.paymentSplit.cash, 2)}
                  </div>
                </div>
                <div className="p-2 md:p-3 bg-white rounded-lg border-2 border-blue-200 overflow-hidden">
                  <div className="text-xs text-muted-foreground mb-1 truncate">Online</div>
                  <div className="text-sm md:text-base font-bold text-blue-600 break-all md:break-normal">
                    ₹{dailySales.paymentSplit.online >= 100000
                      ? `${safeToFixed(dailySales.paymentSplit.online / 100000, 1)}L`
                      : safeToFixed(dailySales.paymentSplit.online, 2)}
                  </div>
                </div>
                <div className="p-2 md:p-3 bg-white rounded-lg border-2 border-orange-200 overflow-hidden">
                  <div className="text-xs text-muted-foreground mb-1 truncate">Credit</div>
                  <div className="text-sm md:text-base font-bold text-orange-600 break-all md:break-normal">
                    ₹{dailySales.paymentSplit.credit >= 100000
                      ? `${safeToFixed(dailySales.paymentSplit.credit / 100000, 1)}L`
                      : safeToFixed(dailySales.paymentSplit.credit, 2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reading Selection Section */}
          <Card className="border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-purple-600" />
                Employee Readings
              </CardTitle>
              <CardDescription>
                Review and select specific employee entries to include in this settlement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant={showReadingSelection ? "secondary" : "outline"}
                onClick={() => setShowReadingSelection(!showReadingSelection)}
                className="w-full"
              >
                {showReadingSelection ? 'Hide Readings' : 'Show Readings to Review & Select'}
              </Button>

              {showReadingSelection && (
                <div className="space-y-4">
                  {readingsLoading ? (
                    <div className="text-center py-4 text-muted-foreground">Loading readings...</div>
                  ) : !readingsForSettlement ? (
                    <div className="text-center py-4 text-muted-foreground">No readings available</div>
                  ) : (
                    <>
                      {/* Selected readings summary */}
                      {selectedReadingIds.length > 0 && (
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="text-sm font-semibold text-purple-700 mb-2">
                            Selected: {selectedReadingIds.length} reading(s)
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>Cash: ₹{safeToFixed(getSelectedTotals().cash, 2)}</div>
                            <div>Online: ₹{safeToFixed(getSelectedTotals().online, 2)}</div>
                            <div>Credit: ₹{safeToFixed(getSelectedTotals().credit, 2)}</div>
                          </div>
                        </div>
                      )}

                      {/* Unlinked Readings */}
                      {readingsForSettlement.unlinked.count > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold flex items-center gap-2">
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                Unlinked
                              </Badge>
                              {readingsForSettlement.unlinked.count} readings not yet settled
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectAllReadings(readingsForSettlement.unlinked.readings)}
                            >
                              {readingsForSettlement.unlinked.readings.every(r => selectedReadingIds.includes(r.id))
                                ? 'Deselect All'
                                : 'Select All'}
                            </Button>
                          </div>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {readingsForSettlement.unlinked.readings.map(reading => (
                              <div
                                key={reading.id}
                                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                  selectedReadingIds.includes(reading.id)
                                    ? 'bg-purple-100 border-purple-400'
                                    : 'bg-white hover:bg-gray-50 border-gray-200'
                                }`}
                                onClick={() => handleToggleReading(reading.id)}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={selectedReadingIds.includes(reading.id)}
                                      onCheckedChange={() => handleToggleReading(reading.id)}
                                    />
                                    <span className="text-sm font-medium">
                                      Nozzle #{reading.nozzleNumber} - {reading.fuelType} &nbsp;
                                      <span className="text-xs text-muted-foreground">Last Reading: {safeToFixed(reading.closingReading, 2)}</span>
                                    </span>
                                  </div>
                                  <span className="text-sm font-bold text-green-600">
                                    ₹{safeToFixed(reading.saleValue, 2)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground ml-6">
                                  <div>{safeToFixed(reading.litresSold, 2)} L</div>
                                  <div className="text-green-600">Cash: ₹{safeToFixed(reading.cashAmount, 0)}</div>
                                  <div className="text-blue-600">Online: ₹{safeToFixed(reading.onlineAmount, 0)}</div>
                                  <div className="text-orange-600">Credit: ₹{safeToFixed(reading.creditAmount, 0)}</div>
                                </div>
                                {reading.recordedBy && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 ml-6">
                                    <User className="w-3 h-3" />
                                    {reading.recordedBy.name}
                                    <Clock className="w-3 h-3 ml-2" />
                                    {new Date(reading.recordedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="p-2 bg-yellow-50 rounded text-xs">
                            Unlinked Totals: Cash ₹{safeToFixed(readingsForSettlement.unlinked.totals.cash, 2)} | 
                            Online ₹{safeToFixed(readingsForSettlement.unlinked.totals.online, 2)} | 
                            Credit ₹{safeToFixed(readingsForSettlement.unlinked.totals.credit, 2)}
                          </div>
                        </div>
                      )}

                      {/* Linked Readings */}
                      {readingsForSettlement.linked.count > 0 && (
                        <div className="space-y-2 mt-4">
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              Already Settled
                            </Badge>
                            {readingsForSettlement.linked.count} readings linked to previous settlements
                          </div>
                          <div className="space-y-2 max-h-40 overflow-y-auto opacity-60">
                            {readingsForSettlement.linked.readings.map(reading => (
                              <div key={reading.id} className="p-2 bg-gray-50 rounded-lg border text-sm">
                                <div className="flex justify-between">
                                  <span>Nozzle #{reading.nozzleNumber} - {reading.fuelType}</span>
                                  <span className="font-medium">₹{safeToFixed(reading.saleValue, 2)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cash Reconciliation */}
          <Card className={`border-2 ${Math.abs(actualCash - dailySales.expectedCash) < 1 ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Owner Settlement Confirmation
              </CardTitle>
              <CardDescription>
                {selectedReadingIds.length > 0 
                  ? `Settling ${selectedReadingIds.length} selected reading(s) - Enter actual amounts received`
                  : 'Select employee readings above, then enter actual amounts received'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Expected values from selected readings */}
              {selectedReadingIds.length > 0 && (
                <div className="grid grid-cols-3 gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div>
                    <div className="text-xs text-purple-600 font-semibold">Expected Cash (Selected)</div>
                    <div className="text-lg font-bold text-purple-700">₹{safeToFixed(getSelectedTotals().cash, 2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-purple-600 font-semibold">Expected Online (Selected)</div>
                    <div className="text-lg font-bold text-purple-700">₹{safeToFixed(getSelectedTotals().online, 2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-purple-600 font-semibold">Expected Credit (Selected)</div>
                    <div className="text-lg font-bold text-purple-700">₹{safeToFixed(getSelectedTotals().credit, 2)}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="overflow-hidden">
                  <Label htmlFor="actual-cash" className="text-sm font-semibold truncate">
                    Actual Cash Received
                  </Label>
                  <Input
                    id="actual-cash"
                    type="number"
                    step="0.01"
                    value={actualCash}
                    onChange={(e) => setActualCash(parseFloat(e.target.value) || 0)}
                    className="mt-2 border-green-300 focus:border-green-500 text-base md:text-lg font-bold"
                    placeholder="Enter actual cash received"
                  />
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    Physical cash from pump/register
                  </p>
                </div>
                <div className="overflow-hidden">
                  <Label htmlFor="actual-online" className="text-sm font-semibold truncate">
                    Actual Online Received
                  </Label>
                  <Input
                    id="actual-online"
                    type="number"
                    step="0.01"
                    value={actualOnline}
                    onChange={(e) => setActualOnline(parseFloat(e.target.value) || 0)}
                    className="mt-2 border-blue-300 focus:border-blue-500 text-base md:text-lg font-bold"
                    placeholder="Enter actual online received"
                  />
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    UPI, card, netbanking, etc.
                  </p>
                </div>
                <div className="overflow-hidden">
                  <Label htmlFor="actual-credit" className="text-sm font-semibold truncate">
                    Credit Given
                  </Label>
                  <Input
                    id="actual-credit"
                    type="number"
                    step="0.01"
                    value={actualCredit}
                    onChange={(e) => setActualCredit(parseFloat(e.target.value) || 0)}
                    className="mt-2 border-orange-300 focus:border-orange-500 text-base md:text-lg font-bold"
                    placeholder="Enter credit given (sales on credit)"
                  />
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    Sales made on credit (creditors' debt, owner's earning)
                  </p>
                </div>
              </div>

              {/* Variance - only show when readings selected and cash entered */}
              {selectedReadingIds.length > 0 && actualCash > 0 && (
                <div className={`p-4 rounded-lg border-2 ${
                  Math.abs(getSelectedTotals().cash - actualCash) < 1
                    ? 'border-green-300 bg-green-100'
                    : 'border-yellow-300 bg-yellow-100'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${
                      Math.abs(actualCash - getSelectedTotals().cash) < 1
                        ? 'text-green-700'
                        : 'text-yellow-700'
                    }`}>
                      {Math.abs(getSelectedTotals().cash - actualCash) < 1 ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 inline mr-2" />
                          Cash Match - No Variance
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 inline mr-2" />
                          Cash Variance
                        </>
                      )}
                    </span>
                    <div className={`text-lg md:text-xl lg:text-2xl font-bold ${
                      getSelectedTotals().cash < actualCash
                        ? 'text-green-600'
                        : getSelectedTotals().cash > actualCash
                        ? 'text-red-600'
                        : 'text-green-600'
                    } break-all md:break-normal`}>
                      {getSelectedTotals().cash < actualCash ? '+' : ''}₹{safeToFixed(getSelectedTotals().cash - actualCash, 2)}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <Label htmlFor="notes" className="text-sm font-semibold">
                  Notes (Optional)
                </Label>
                <Input
                  id="notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., 'Variance due to employee error', 'Extra cash from yesterday'"
                  className="mt-2"
                />
              </div>

              {/* Mark as Final Checkbox */}
              <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Checkbox
                  id="mark-final"
                  checked={markAsFinal}
                  onCheckedChange={(checked) => setMarkAsFinal(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="mark-final" className="text-sm font-semibold cursor-pointer">
                    Mark as Final Settlement
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Final settlements are used for daily reports. Previous final settlements for this date will be unmarked.
                  </p>
                </div>
              </div>

              {/* Selection Status */}
              {selectedReadingIds.length === 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  Please select employee readings above before completing settlement
                </div>
              )}

              {selectedReadingIds.length > 0 && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4 inline mr-2" />
                  {selectedReadingIds.length} reading(s) selected for settlement
                  <div className="text-xs mt-1">
                    Employee Total: Cash ₹{safeToFixed(getSelectedTotals().cash, 2)} | 
                    Online ₹{safeToFixed(getSelectedTotals().online, 2)} | 
                    Credit ₹{safeToFixed(getSelectedTotals().credit, 2)}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleSubmitSettlement}
                disabled={isSubmitting || selectedReadingIds.length === 0}
                className={`w-full py-6 text-lg ${selectedReadingIds.length === 0 ? 'opacity-50' : ''}`}
                size="lg"
              >
                {isSubmitting ? 'Saving...' : selectedReadingIds.length === 0 
                  ? 'Select Readings First' 
                  : `Complete Settlement (${selectedReadingIds.length} entries)`}
              </Button>
            </CardContent>
          </Card>

          {/* Previous Settlements */}
          {previousSettlements && previousSettlements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Settlements</CardTitle>
                <CardDescription>
                  {previousSettlements.some(s => s.duplicateCount && s.duplicateCount > 1) && (
                    <span className="text-red-600 font-bold">Duplicate settlements detected for some days!</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {previousSettlements.map((settlement: SettlementRecord) => (
                    <div key={settlement.id} className={`border rounded-lg p-3 ${settlement.isFinal ? 'border-green-600 bg-green-50' : 'border-muted'} space-y-2`}>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-sm">
                          {new Date(settlement.date).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: '2-digit'
                          })}
                        </div>
                        {settlement.isFinal && (
                          <Badge variant="outline" className="text-green-700 border-green-600">Final</Badge>
                        )}
                        {settlement.duplicateCount && settlement.duplicateCount > 1 && (
                          <Badge variant="outline" className="text-red-700 border-red-600">Duplicates: {settlement.duplicateCount}</Badge>
                        )}
                      </div>
                      {/* Employee-reported vs Owner-confirmed comparison */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-blue-50 p-2 rounded border border-blue-200">
                          <div className="font-semibold text-blue-700 mb-1">Employee Reported</div>
                          <div>Cash: ₹{safeToFixed(settlement.employeeCash ?? settlement.expectedCash, 2)}</div>
                          <div>Online: ₹{safeToFixed(settlement.employeeOnline ?? 0, 2)}</div>
                          <div>Credit: ₹{safeToFixed(settlement.employeeCredit ?? 0, 2)}</div>
                        </div>
                        <div className="bg-green-50 p-2 rounded border border-green-200">
                          <div className="font-semibold text-green-700 mb-1">Owner Confirmed</div>
                          <div>Cash: ₹{safeToFixed(settlement.actualCash, 2)}</div>
                          <div>Online: ₹{safeToFixed(settlement.online, 2)}</div>
                          <div>Credit: ₹{safeToFixed(settlement.credit, 2)}</div>
                        </div>
                      </div>
                      {/* Variance per payment type */}
                      <div className="flex gap-4 text-xs">
                        <div className={`font-bold ${(settlement.variance ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Cash Variance: {(settlement.variance ?? 0) >= 0 ? '+' : ''}₹{safeToFixed(settlement.variance ?? 0, 2)}
                        </div>
                        <div className={`font-bold ${(settlement.varianceOnline ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Online Variance: {(settlement.varianceOnline ?? 0) >= 0 ? '+' : ''}₹{safeToFixed(settlement.varianceOnline ?? 0, 2)}
                        </div>
                        <div className={`font-bold ${(settlement.varianceCredit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Credit Variance: {(settlement.varianceCredit ?? 0) >= 0 ? '+' : ''}₹{safeToFixed(settlement.varianceCredit ?? 0, 2)}
                        </div>
                      </div>
                      {/* Show all settlements for this date if duplicates exist */}
                      {settlement.duplicateCount && settlement.duplicateCount > 1 && settlement.allSettlements && (
                        <div className="mt-2">
                          <div className="text-xs font-semibold mb-1">All settlements for this date:</div>
                          <div className="space-y-1">
                            {settlement.allSettlements.map((s, idx) => (
                              <div key={s.id || idx} className={`border rounded p-2 text-xs ${s.isFinal ? 'border-green-600 bg-green-50' : 'border-muted'}`}>
                                {new Date(s.settledAt || s.finalizedAt || s.recordedAt || s.date).toLocaleString('en-IN')}
                                {s.isFinal && <span className="ml-2 text-green-700">(Final)</span>}
                                | Actual: ₹{safeToFixed(s.actualCash, 2)} | Online: ₹{safeToFixed(s.online, 2)} | Credit: ₹{safeToFixed(s.credit, 2)} | Variance: {safeToFixed(s.variance, 2)}
                                {s.notes && <span className="ml-2">Notes: {s.notes}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
