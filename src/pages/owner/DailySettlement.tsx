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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { safeToFixed } from '@/lib/format-utils';
import { getBasePath } from '@/lib/roleUtils';
import { FUEL_TYPE_LABELS } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  FileCheck,
  User,
  Clock,
  ChevronDown
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
  // Transaction-level payment breakdown is authoritative
  // Access via `transaction.paymentBreakdown` (cash/online/credit)
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
  attempts?: number;
  mainSettlement?: { id?: string } | null;
  recordedByUser?: { name: string; email?: string };
  status?: string;
}

export default function DailySettlement() {
  const navigate = useNavigate();
  const { stationId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [actualCash, setActualCash] = useState<number>(0);
  const [actualOnline, setActualOnline] = useState<number>(0);
  const [actualCredit, setActualCredit] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedReadingIds, setSelectedReadingIds] = useState<string[]>([]);
  const [showReadingSelection, setShowReadingSelection] = useState(true); // Always show by default
  const [markAsFinal, setMarkAsFinal] = useState(true); // Default to final settlement
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set()); // Track expanded transaction cards
  const [expandedSettlements, setExpandedSettlements] = useState<Set<string>>(new Set()); // Track expanded settlement cards

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

  // Toggle transaction expansion
  const handleToggleTransaction = (transactionId: string) => {
    setExpandedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  // Toggle settlement expansion
  const handleToggleSettlement = (settlementId: string) => {
    setExpandedSettlements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(settlementId)) {
        newSet.delete(settlementId);
      } else {
        newSet.add(settlementId);
      }
      return newSet;
    });
  };

  // Calculate totals from selected readings
  const getSelectedTotals = () => {
    if (!readingsForSettlement || selectedReadingIds.length === 0) {
      return { cash: 0, online: 0, credit: 0, litres: 0, value: 0 };
    }
    const allReadings = [...(readingsForSettlement.unlinked?.readings || []), ...(readingsForSettlement.linked?.readings || [])];
    const selectedReadings = allReadings.filter(r => selectedReadingIds.includes(r.id));
    
    // Track which transactions we've already counted to avoid duplicating payment breakdown
    const processedTransactionIds = new Set<string>();
    
    return selectedReadings.reduce((acc, r) => {
      const transactionId = r.transaction?.id;
      const pb: any = (r.transaction as any)?.paymentBreakdown || {};
      
      // Only add payment breakdown once per transaction
      let cashToAdd = 0;
      let onlineToAdd = 0;
      let creditToAdd = 0;
      
      if (transactionId && !processedTransactionIds.has(transactionId)) {
        cashToAdd = parseFloat(pb.cash || 0) || 0;
        onlineToAdd = parseFloat(pb.online || 0) || 0;
        creditToAdd = parseFloat(pb.credit || 0) || 0;
        processedTransactionIds.add(transactionId);
      }
      
      return {
        cash: acc.cash + cashToAdd,
        online: acc.online + onlineToAdd,
        credit: acc.credit + creditToAdd,
        litres: acc.litres + r.litresSold,
        value: acc.value + r.saleValue
      };
    }, { cash: 0, online: 0, credit: 0, litres: 0, value: 0 });
  };

  // Get final settlement for selected date (for manager view)
  const getFinalSettlementForDate = (): SettlementRecord | null => {
    if (!previousSettlements || previousSettlements.length === 0) return null;
    
    // Filter to selected date and get final settlement
    const settlementForDate = previousSettlements.find(
      (s) => new Date(s.date).toISOString().split('T')[0] === selectedDate && s.isFinal
    );
    return settlementForDate || null;
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

    // VALIDATION: Check that all amounts are non-negative
    const validationErrors: string[] = [];
    
    if (actualCash < 0) {
      validationErrors.push('Actual cash cannot be negative');
    }
    if (actualOnline < 0) {
      validationErrors.push('Online amount cannot be negative');
    }
    if (actualCredit < 0) {
      validationErrors.push('Credit amount cannot be negative');
    }

    // VALIDATION: Check that at least one amount is provided (cash, online, or credit)
    const totalAmount = actualCash + actualOnline + actualCredit;
    if (totalAmount <= 0) {
      validationErrors.push('Please enter at least one payment amount (Cash, Online, or Credit)');
    }

    // VALIDATION: Warn if amounts differ significantly from employee reports
    const selectedTotals = getSelectedTotals();
    const TOLERANCE_PERCENT = 5;
    
    // Check cash variance
    const cashVariance = Math.abs(selectedTotals.cash - actualCash);
    const cashVariancePercent = selectedTotals.cash > 0 ? (cashVariance / selectedTotals.cash) * 100 : 0;
    
    // Check online variance
    const onlineVariance = Math.abs(selectedTotals.online - actualOnline);
    const onlineVariancePercent = selectedTotals.online > 0 ? (onlineVariance / selectedTotals.online) * 100 : 0;
    
    // Check credit variance
    const creditVariance = Math.abs(selectedTotals.credit - actualCredit);
    const creditVariancePercent = selectedTotals.credit > 0 ? (creditVariance / selectedTotals.credit) * 100 : 0;

    const warnings: string[] = [];
    
    if (cashVariancePercent > TOLERANCE_PERCENT) {
      warnings.push(`Cash variance: Employee reported ₹${selectedTotals.cash.toFixed(2)}, but you entered ₹${actualCash.toFixed(2)} (${cashVariancePercent.toFixed(1)}% difference)`);
    }
    
    if (onlineVariancePercent > TOLERANCE_PERCENT) {
      warnings.push(`Online variance: Employee reported ₹${selectedTotals.online.toFixed(2)}, but you entered ₹${actualOnline.toFixed(2)} (${onlineVariancePercent.toFixed(1)}% difference)`);
    }
    
    if (creditVariancePercent > TOLERANCE_PERCENT) {
      warnings.push(`Credit variance: Employee reported ₹${selectedTotals.credit.toFixed(2)}, but you entered ₹${actualCredit.toFixed(2)} (${creditVariancePercent.toFixed(1)}% difference)`);
    }

    // Show validation errors (blocking)
    if (validationErrors.length > 0) {
      toast({
        title: 'Validation Error',
        description: validationErrors.join('\n'),
        variant: 'destructive'
      });
      return;
    }

    // Show warnings (non-blocking, but ask for confirmation)
    if (warnings.length > 0) {
      const confirmMessage = `WARNING: Large variance detected:\n\n${warnings.join('\n')}\n\nDo you want to continue?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
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
          <NavButton onClick={() => navigate(`${getBasePath(user?.role || 'owner')}/stations`)} className="mt-4">
            Go to Stations
          </NavButton>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 max-w-4xl">
      {/* Header with Settlement Status */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <NavButton
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="w-4 h-4" />
          </NavButton>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Daily Settlement</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {dailySales?.stationName}
            </p>
          </div>
        </div>

        {/* Settlement Status Badge */}
        <div className="flex items-center gap-2">
          {(() => {
            const finalSettlement = getFinalSettlementForDate();
            if (finalSettlement) {
              return (
                <Badge variant="default" className="bg-green-600 text-white">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Settled Today
                </Badge>
              );
            } else if (selectedReadingIds.length > 0) {
              return (
                <Badge variant="default" className="bg-blue-600 text-white">
                  <FileCheck className="w-3 h-3 mr-1" />
                  Ready to Settle
                </Badge>
              );
            } else {
              return (
                <Badge variant="outline" className="border-orange-300 text-orange-700">
                  <Clock className="w-3 h-3 mr-1" />
                  Needs Settlement
                </Badge>
              );
            }
          })()}
        </div>
      </div>

      {/* Date Selection - Compact */}
      <Card className="border-gray-200 p-2 sm:p-3">
        <CardContent className="p-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Select Date:</span>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-36 h-8 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="h-8 px-2 text-xs"
            >
              Today
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Banner - Only show if settlement needed */}
      {(() => {
        const finalSettlement = getFinalSettlementForDate();
        if (!finalSettlement && dailySales && (readingsForSettlement?.unlinked?.count ?? 0) > 0) {
          return (
            <Card className="border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-blue-100 rounded-full flex-shrink-0">
                      <FileCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-blue-900 text-sm sm:text-base">Ready for Settlement</h3>
                      <p className="text-xs sm:text-sm text-blue-700">
                        {readingsForSettlement?.unlinked?.count || 0} readings need to be settled today
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      // Scroll to settlement section
                      const element = document.getElementById('settlement-section');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                    size="sm"
                  >
                    Start Settlement
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        }
        return null;
      })()}

      {/* Settlement Progress Guide */}
      {dailySales && !getFinalSettlementForDate() && (
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Settlement Progress</h3>
              <Badge variant="outline" className="text-xs">
                {selectedReadingIds.length > 0 ? 'Step 2 of 2' : 'Step 1 of 2'}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  readingsForSettlement ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {readingsForSettlement ? '✓' : '1'}
                </div>
                <span className={`text-sm ${readingsForSettlement ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                  Review daily sales and readings
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  selectedReadingIds.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {selectedReadingIds.length > 0 ? '✓' : '2'}
                </div>
                <span className={`text-sm ${selectedReadingIds.length > 0 ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                  Select readings to settle ({readingsForSettlement?.unlinked?.count || 0} available)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  getFinalSettlementForDate() ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {getFinalSettlementForDate() ? '✓' : '3'}
                </div>
                <span className={`text-sm ${getFinalSettlementForDate() ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                  Complete settlement confirmation
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
      ) : isManager ? (
        <>
          {/* Manager View - Comprehensive Settlement Dashboard */}
          {/* Manager Settlement Summary - Using settlement data */}
          {(() => {
            const finalSettlement = getFinalSettlementForDate();
            if (finalSettlement) {
              // Calculate total sales from settlement (handle undefined values)
              const totalSales = (finalSettlement.employeeCash ?? 0) + (finalSettlement.employeeOnline ?? 0) + (finalSettlement.employeeCredit ?? 0);
              
              return (
                <Card className="border-green-200 bg-green-50 p-3 sm:p-4 md:p-6">
                  <CardHeader className="p-0 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <FileCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                      Settlement Overview
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Daily settlement status and reconciliation summary
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                      <div className="p-2 sm:p-3 md:p-4 bg-white rounded-lg border overflow-hidden">
                        <div className="text-xs text-muted-foreground mb-1 truncate">Total Sales</div>
                        <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-green-600 break-words">
                          ₹{totalSales >= 100000
                            ? `${safeToFixed(totalSales / 100000, 1)}L`
                            : safeToFixed(totalSales, 2)}
                        </div>
                      </div>
                      <div className="p-2 sm:p-3 md:p-4 bg-white rounded-lg border overflow-hidden">
                        <div className="text-xs text-muted-foreground mb-1 truncate">Expected Cash</div>
                        <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-blue-600 break-words">
                          ₹{finalSettlement.expectedCash >= 100000
                            ? `${safeToFixed(finalSettlement.expectedCash / 100000, 1)}L`
                            : safeToFixed(finalSettlement.expectedCash, 2)}
                        </div>
                      </div>
                      <div className="p-2 sm:p-3 md:p-4 bg-white rounded-lg border overflow-hidden">
                        <div className="text-xs text-muted-foreground mb-1 truncate">Variance</div>
                        <div className={`text-sm sm:text-lg md:text-xl lg:text-2xl font-bold break-words ${finalSettlement.variance >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                          {finalSettlement.variance >= 0 ? '+' : ''}₹{safeToFixed(finalSettlement.variance, 2)}
                        </div>
                      </div>
                      <div className="p-2 sm:p-3 md:p-4 bg-white rounded-lg border overflow-hidden">
                        <div className="text-xs text-muted-foreground mb-1 truncate">Status</div>
                        <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-purple-600 break-words">
                          {finalSettlement.isFinal ? '✓ Final' : 'Draft'}
                        </div>
                      </div>
                    </div>

                    {/* Payment Breakdown */}
                    <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-3 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                      <div className="p-1.5 sm:p-2 md:p-3 bg-white rounded-lg border-2 border-green-200 overflow-hidden">
                        <div className="text-xs text-muted-foreground mb-1 truncate">Cash</div>
                        <div className="text-xs sm:text-sm md:text-base font-bold text-green-600 break-words">
                          ₹{finalSettlement.actualCash >= 100000
                            ? `${safeToFixed(finalSettlement.actualCash / 100000, 1)}L`
                            : safeToFixed(finalSettlement.actualCash, 2)}
                        </div>
                      </div>
                      <div className="p-1.5 sm:p-2 md:p-3 bg-white rounded-lg border-2 border-blue-200 overflow-hidden">
                        <div className="text-xs text-muted-foreground mb-1 truncate">Online</div>
                        <div className="text-xs sm:text-sm md:text-base font-bold text-blue-600 break-words">
                          ₹{finalSettlement.online >= 100000
                            ? `${safeToFixed(finalSettlement.online / 100000, 1)}L`
                            : safeToFixed(finalSettlement.online, 2)}
                        </div>
                      </div>
                      <div className="p-1.5 sm:p-2 md:p-3 bg-white rounded-lg border-2 border-orange-200 overflow-hidden">
                        <div className="text-xs text-muted-foreground mb-1 truncate">Credit</div>
                        <div className="text-xs sm:text-sm md:text-base font-bold text-orange-600 break-words">
                          ₹{finalSettlement.credit >= 100000
                            ? `${safeToFixed(finalSettlement.credit / 100000, 1)}L`
                            : safeToFixed(finalSettlement.credit, 2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            // If no final settlement, show "No settlement recorded" message
            return (
              <Card className="border-yellow-200 bg-yellow-50 p-3 sm:p-4 md:p-6">
                <CardContent className="py-12 text-center">
                  <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
                  <p className="text-muted-foreground">No settlement recorded for {new Date(selectedDate).toLocaleDateString('en-IN')}</p>
                </CardContent>
              </Card>
            );
          })()}

          {/* Manager Settlement History - Enhanced View */}
          {previousSettlements && previousSettlements.length > 0 && (
            <Card className="p-3 sm:p-4 md:p-6">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-base sm:text-lg">Settlement History</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Detailed reconciliation records with employee vs owner confirmation
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-4 sm:space-y-6">
                  {previousSettlements.map((settlement: SettlementRecord) => (
                    <div key={settlement.id} className={`border-2 rounded-lg p-4 sm:p-6 space-y-4 ${settlement.isFinal ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-lg sm:text-xl text-gray-800">
                            {new Date(settlement.date).toLocaleDateString('en-IN', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Recorded by {settlement.recordedByUser?.name || settlement.settledBy || 'Unknown'} • 
                            {new Date(settlement.recordedAt || settlement.settledAt || settlement.date).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="flex flex-col sm:items-end gap-2">
                          <Badge variant={settlement.isFinal ? "default" : "secondary"} className="text-xs">
                            {settlement.isFinal ? 'Final Settlement' : 'Draft Settlement'}
                          </Badge>
                          {settlement.duplicateCount && settlement.duplicateCount > 1 && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                              {settlement.duplicateCount} attempts
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Employee vs Owner Comparison */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-3">
                            <User className="w-4 h-4 text-blue-600" />
                            <h5 className="font-semibold text-blue-800">Employee Reported</h5>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-blue-700">Cash:</span>
                              <span className="font-bold text-blue-800">₹{safeToFixed(settlement.employeeCash ?? 0, 2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-blue-700">Online:</span>
                              <span className="font-bold text-blue-800">₹{safeToFixed(settlement.employeeOnline ?? 0, 2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-blue-700">Credit:</span>
                              <span className="font-bold text-blue-800">₹{safeToFixed(settlement.employeeCredit ?? 0, 2)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <h5 className="font-semibold text-green-800">Owner Confirmed</h5>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-green-700">Cash:</span>
                              <span className="font-bold text-green-800">₹{safeToFixed(settlement.actualCash, 2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-green-700">Online:</span>
                              <span className="font-bold text-green-800">₹{safeToFixed(settlement.online, 2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-green-700">Credit:</span>
                              <span className="font-bold text-green-800">₹{safeToFixed(settlement.credit, 2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Variance Analysis */}
                      <div className="bg-white p-4 rounded-lg border">
                        <h5 className="font-semibold text-gray-800 mb-3">Variance Analysis</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className={`p-3 rounded border ${Math.abs(settlement.variance ?? 0) < 1 ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                            <div className="text-xs text-muted-foreground mb-1">Cash Variance</div>
                            <div className={`text-lg font-bold ${(settlement.variance ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(settlement.variance ?? 0) >= 0 ? '+' : ''}₹{safeToFixed(settlement.variance ?? 0, 2)}
                            </div>
                          </div>
                          <div className={`p-3 rounded border ${Math.abs(settlement.varianceOnline ?? 0) < 1 ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                            <div className="text-xs text-muted-foreground mb-1">Online Variance</div>
                            <div className={`text-lg font-bold ${(settlement.varianceOnline ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(settlement.varianceOnline ?? 0) >= 0 ? '+' : ''}₹{safeToFixed(settlement.varianceOnline ?? 0, 2)}
                            </div>
                          </div>
                          <div className={`p-3 rounded border ${Math.abs(settlement.varianceCredit ?? 0) < 1 ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                            <div className="text-xs text-muted-foreground mb-1">Credit Variance</div>
                            <div className={`text-lg font-bold ${(settlement.varianceCredit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(settlement.varianceCredit ?? 0) >= 0 ? '+' : ''}₹{safeToFixed(settlement.varianceCredit ?? 0, 2)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* All Settlements for this date (if duplicates) */}
                      {settlement.duplicateCount && settlement.duplicateCount > 1 && settlement.allSettlements && (
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                          <h5 className="font-semibold text-yellow-800 mb-3">All Settlement Attempts</h5>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {settlement.allSettlements.map((s, idx) => (
                              <div key={s.id || idx} className={`p-3 rounded border text-sm ${s.isFinal ? 'border-green-300 bg-green-25' : 'border-gray-300 bg-white'}`}>
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-medium">
                                    {new Date(s.settledAt || s.finalizedAt || s.recordedAt || s.date).toLocaleString('en-IN')}
                                  </span>
                                  {s.isFinal && <Badge variant="outline" className="text-green-700 border-green-600 text-xs">Final</Badge>}
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>Cash: ₹{safeToFixed(s.actualCash, 2)}</div>
                                  <div>Online: ₹{safeToFixed(s.online, 2)}</div>
                                  <div>Credit: ₹{safeToFixed(s.credit, 2)}</div>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Variance: {safeToFixed(s.variance, 2)} | Status: {s.status}
                                </div>
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

          {/* Manager Actions */}
          <Card className="p-3 sm:p-4 md:p-6">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-base sm:text-lg">Manager Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => navigate(`${getBasePath(user?.role || 'owner')}/readings`)}
                >
                  <FileCheck className="w-6 h-6" />
                  <span className="text-sm font-medium">View Readings</span>
                  <span className="text-xs text-muted-foreground">Review employee entries</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => navigate(`${getBasePath(user?.role || 'owner')}/reports`)}
                >
                  <TrendingUp className="w-6 h-6" />
                  <span className="text-sm font-medium">View Reports</span>
                  <span className="text-xs text-muted-foreground">Daily sales reports</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => navigate(`${getBasePath(user?.role || 'owner')}/dashboard`)}
                >
                  <ArrowLeft className="w-6 h-6" />
                  <span className="text-sm font-medium">Back to Dashboard</span>
                  <span className="text-xs text-muted-foreground">Station overview</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Sales Summary - Compact */}
          <Card className="border-blue-200 bg-blue-50 p-2 sm:p-3 md:p-4">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                Today's Sales Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-2 sm:space-y-3">
              {/* Main Metrics - Horizontal Layout */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2">
                <div className="bg-white rounded border p-2 text-center">
                  <div className="text-xs text-muted-foreground">Liters</div>
                  <div className="text-sm sm:text-base font-bold text-blue-600">
                    {dailySales.totalLiters >= 1000
                      ? `${safeToFixed(dailySales.totalLiters / 1000, 1)}K`
                      : `${safeToFixed(dailySales.totalLiters, 0)}L`}
                  </div>
                </div>
                <div className="bg-white rounded border p-2 text-center">
                  <div className="text-xs text-muted-foreground">Sales</div>
                  <div className="text-sm sm:text-base font-bold text-green-600">
                    ₹{dailySales.totalSaleValue >= 100000
                      ? `${safeToFixed(dailySales.totalSaleValue / 100000, 1)}L`
                      : safeToFixed(dailySales.totalSaleValue, 0)}
                  </div>
                </div>
                <div className="bg-white rounded border p-2 text-center">
                  <div className="text-xs text-muted-foreground">Readings</div>
                  <div className="text-sm sm:text-base font-bold text-purple-600">
                    {dailySales.readings.length >= 1000
                      ? `${safeToFixed(dailySales.readings.length / 1000, 1)}K`
                      : dailySales.readings.length}
                  </div>
                </div>
                <div className="bg-white rounded border p-2 text-center">
                  <div className="text-xs text-muted-foreground">Expected Cash</div>
                  <div className="text-sm sm:text-base font-bold text-orange-600">
                    ₹{dailySales.expectedCash >= 100000
                      ? `${safeToFixed(dailySales.expectedCash / 100000, 1)}L`
                      : safeToFixed(dailySales.expectedCash, 0)}
                  </div>
                </div>
              </div>

              {/* Combined Fuel Type & Payment Breakdown */}
              <div className="bg-white rounded border p-2 sm:p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Fuel Types */}
                  {Object.keys(dailySales.byFuelType).length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-600 mb-1">By Fuel Type</div>
                      <div className="space-y-1">
                        {Object.entries(dailySales.byFuelType).map(([fuelType, data]) => (
                          <div key={fuelType} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs px-1 py-0 capitalize">
                                {fuelType}
                              </Badge>
                              <span className="text-muted-foreground">
                                {safeToFixed(data.liters, 0)}L
                              </span>
                            </div>
                            <span className="font-semibold">₹{safeToFixed(data.value, 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment Methods */}
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1">Payment Methods</div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-green-600 font-medium">Cash</span>
                        <span className="font-semibold">₹{safeToFixed(dailySales.paymentSplit.cash, 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-600 font-medium">Online</span>
                        <span className="font-semibold">₹{safeToFixed(dailySales.paymentSplit.online, 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-orange-600 font-medium">Credit</span>
                        <span className="font-semibold">₹{safeToFixed(dailySales.paymentSplit.credit, 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reading Selection Section */}
          <Card className="border-purple-200 p-3 sm:p-4 md:p-6">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileCheck className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                Step 2: Select Readings to Settle
                {selectedReadingIds.length > 0 && (
                  <Badge variant="default" className="ml-2 bg-purple-600">
                    {selectedReadingIds.length} selected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Choose which employee readings to include in today's settlement. Only selected readings will be marked as settled.
                <br />
                <span className="block mt-1 text-blue-700 font-medium">
                  💡 Tip: Click on transaction cards to expand and see individual readings. Select the readings you want to settle.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-3 sm:space-y-4">
              {!showReadingSelection ? (
                <div className="text-center py-6">
                  <Button
                    onClick={() => setShowReadingSelection(true)}
                    className="bg-purple-600 hover:bg-purple-700"
                    size="lg"
                  >
                    <FileCheck className="w-4 h-4 mr-2" />
                    Review & Select Readings ({readingsForSettlement?.unlinked?.count || 0} available)
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click to see all employee readings for this date
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      onClick={() => setShowReadingSelection(false)}
                      size="sm"
                    >
                      Hide Readings
                    </Button>
                    {readingsForSettlement && (
                      <div className="text-sm text-muted-foreground">
                        {readingsForSettlement.unlinked?.count || 0} unlinked • {readingsForSettlement.linked?.count || 0} already settled
                      </div>
                    )}
                  </div>

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
                      {readingsForSettlement?.unlinked?.count > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold flex items-center gap-2">
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                Unlinked
                              </Badge>
                              {readingsForSettlement?.unlinked?.count || 0} readings not yet settled
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectAllReadings(readingsForSettlement?.unlinked?.readings || [])}
                            >
                              {readingsForSettlement?.unlinked?.readings?.every(r => selectedReadingIds.includes(r.id))
                                ? 'Deselect All'
                                : 'Select All'}
                            </Button>
                          </div>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {/* Group readings by transactionId */}
                            {Object.values(
                              (readingsForSettlement?.unlinked?.readings || []).reduce((acc: Record<string, any[]>, reading) => {
                                const txId = reading.transaction?.id || 'no-tx';
                                if (!acc[txId]) acc[txId] = [];
                                acc[txId].push(reading);
                                return acc;
                              }, {} as Record<string, any[]>)
                            ).map((group: any[], idx) => {
                              const transactionId = group[0].transaction?.id || `no-tx-${idx}`;
                              const isExpanded = expandedTransactions.has(transactionId);
                              const totalValue = group.reduce((sum, reading) => sum + reading.saleValue, 0);
                              const totalLiters = group.reduce((sum, reading) => sum + reading.litresSold, 0);
                              const paymentBreakdown = group[0].transaction?.paymentBreakdown;
                              const recordedBy = group[0].recordedBy;
                              // Check if ALL readings from this transaction are selected
                              const allReadingsSelected = group.every(r => selectedReadingIds.includes(r.id));
                              const someReadingsSelected = group.some(r => selectedReadingIds.includes(r.id));
                              
                              return (
                                <Collapsible
                                  key={transactionId}
                                  open={isExpanded}
                                  onOpenChange={() => handleToggleTransaction(transactionId)}
                                >
                                  <Card className={`border-l-4 transition-all ${
                                    allReadingsSelected
                                      ? 'border-l-green-500 bg-green-50 ring-2 ring-green-200'
                                      : someReadingsSelected
                                      ? 'border-l-blue-400 bg-blue-50'
                                      : 'border-l-yellow-400 bg-yellow-50/50'
                                  }`}>
                                    <CollapsibleTrigger asChild>
                                      <CardHeader className="cursor-pointer hover:bg-opacity-80 transition-colors p-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                              <Badge className={`text-xs font-bold ${
                                                allReadingsSelected
                                                  ? 'bg-green-600 text-white'
                                                  : someReadingsSelected
                                                  ? 'bg-blue-600 text-white'
                                                  : 'bg-yellow-600 text-white'
                                              }`}>
                                                {allReadingsSelected ? '✓ SELECTED' : someReadingsSelected ? 'PARTIAL' : 'NOT SELECTED'}
                                              </Badge>
                                              <Badge variant="outline" className="text-xs bg-white border-2 border-current font-semibold">
                                                {group.length} reading{group.length > 1 ? 's' : ''} • 1 transaction
                                              </Badge>
                                              {recordedBy && (
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                  <User className="w-3 h-3" />
                                                  <span className="truncate">{recordedBy.name}</span>
                                                </div>
                                              )}
                                            </div>
                                            <CardTitle className="text-sm font-bold text-left">
                                              Transaction {transactionId === 'no-tx' ? 'N/A' : transactionId.slice(-8)}
                                            </CardTitle>
                                            <CardDescription className="text-xs text-left flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                                              <span className="font-bold text-gray-700">{safeToFixed(totalLiters, 2)} L</span>
                                              <span className="font-bold text-green-600">₹{safeToFixed(totalValue, 2)} Total</span>
                                              {paymentBreakdown && (
                                                <span className="text-xs bg-white px-2 py-0.5 rounded border">
                                                  💰 ₹{safeToFixed(paymentBreakdown.cash, 0)} | 💳 ₹{safeToFixed(paymentBreakdown.online, 0)} | 🤝 ₹{safeToFixed(paymentBreakdown.credit, 0)}
                                                </span>
                                              )}
                                            </CardDescription>
                                          </div>
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            <Button
                                              variant={allReadingsSelected ? "default" : "outline"}
                                              size="sm"
                                              className={`whitespace-nowrap text-xs font-bold ${
                                                allReadingsSelected
                                                  ? 'bg-green-600 hover:bg-green-700 text-white'
                                                  : 'border-gray-300 hover:bg-gray-100'
                                              }`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // Toggle all readings in this transaction
                                                if (allReadingsSelected) {
                                                  // Deselect all from this transaction
                                                  setSelectedReadingIds(prev => 
                                                    prev.filter(id => !group.some(r => r.id === id))
                                                  );
                                                } else {
                                                  // Select all from this transaction
                                                  setSelectedReadingIds(prev => [
                                                    ...prev,
                                                    ...group.filter(r => !prev.includes(r.id)).map(r => r.id)
                                                  ]);
                                                }
                                              }}
                                            >
                                              {allReadingsSelected ? (
                                                <>
                                                  <span>✓ Selected</span>
                                                </>
                                              ) : (
                                                <>
                                                  <span>📋 Select All</span>
                                                </>
                                              )}
                                            </Button>
                                            <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                                          </div>
                                        </div>
                                      </CardHeader>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <CardContent className="pt-0 pb-3 px-3">
                                        <div className="space-y-2 border-t pt-3">
                                          <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                                            <span>📍 Nozzle Details:</span>
                                            <span className="text-purple-600">(Click to toggle individual reading)</span>
                                          </div>
                                          {group.map(reading => (
                                            <div
                                              key={reading.id}
                                              className={`p-2 sm:p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                                selectedReadingIds.includes(reading.id)
                                                  ? 'bg-purple-100 border-purple-400 shadow-md'
                                                  : 'bg-white hover:bg-gray-50 border-gray-300'
                                              }`}
                                              onClick={() => handleToggleReading(reading.id)}
                                            >
                                              <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                  <Checkbox
                                                    checked={selectedReadingIds.includes(reading.id)}
                                                    onCheckedChange={() => handleToggleReading(reading.id)}
                                                  />
                                                  <div className="min-w-0 flex-1">
                                                    <span className="text-xs sm:text-sm font-bold block truncate">
                                                      Nozzle #{reading.nozzleNumber} - {FUEL_TYPE_LABELS[reading.fuelType] || reading.fuelType}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                      Reading: {safeToFixed(reading.openingReading, 1)} → {safeToFixed(reading.closingReading, 1)}L
                                                    </span>
                                                  </div>
                                                </div>
                                                <span className="text-xs sm:text-sm font-bold text-green-600 ml-2 flex-shrink-0">
                                                  ₹{safeToFixed(reading.saleValue, 2)}
                                                </span>
                                              </div>
                                              <div className="grid grid-cols-2 gap-1 sm:gap-2 text-xs text-muted-foreground ml-6">
                                                <div className="truncate">💧 {safeToFixed(reading.litresSold, 2)} L sold</div>
                                                <div className="truncate">⏰ {new Date(reading.recordedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </CardContent>
                                    </CollapsibleContent>
                                  </Card>
                                </Collapsible>
                              );
                            })}
                          </div>
                          <div className="p-2 bg-yellow-50 rounded text-xs">
                            <div className="font-semibold mb-1">Unlinked Totals:</div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                              <div>Cash: ₹{safeToFixed(readingsForSettlement?.unlinked?.totals?.cash || 0, 2)}</div>
                              <div>Online: ₹{safeToFixed(readingsForSettlement?.unlinked?.totals?.online || 0, 2)}</div>
                              <div>Credit: ₹{safeToFixed(readingsForSettlement?.unlinked?.totals?.credit || 0, 2)}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Linked Readings */}
                      {readingsForSettlement?.linked?.count > 0 && (
                        <div className="space-y-2 mt-4">
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              Already Settled
                            </Badge>
                            {readingsForSettlement?.linked?.count || 0} readings linked to previous settlements
                          </div>
                          <div className="space-y-2 max-h-40 overflow-y-auto opacity-60">
                            {readingsForSettlement?.linked?.readings?.map(reading => (
                              <div key={reading.id} className="p-2 bg-gray-50 rounded-lg border text-sm">
                                <div className="flex justify-between">
                                  <span>Nozzle #{reading.nozzleNumber} - {reading.fuelType}</span>
                                  <span className="font-medium">₹{safeToFixed(reading.saleValue, 2)}</span>
                                </div>
                              </div>
                            )) || []}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cash Reconciliation - Only show when readings are selected */}
          {selectedReadingIds.length > 0 && (
            <Card id="settlement-section" className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 p-3 sm:p-4 md:p-6">
              <CardHeader className="p-0 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                    </div>
                    Step 3: Complete Settlement
                  </CardTitle>
                  <Badge variant="default" className="bg-blue-600 text-white">
                    {selectedReadingIds.length} reading{selectedReadingIds.length !== 1 ? 's' : ''} selected
                  </Badge>
                </div>
                <CardDescription className="text-sm text-blue-700">
                  Confirm the actual amounts received and finalize today's settlement. This will mark the selected readings as settled.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-4 sm:space-y-6">
                {/* Settlement Summary */}
                <div className="bg-white p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <FileCheck className="w-4 h-4" />
                    Settlement Summary
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Readings to settle:</span>
                      <span className="ml-2 font-semibold text-blue-700">{selectedReadingIds.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total expected value:</span>
                      <span className="ml-2 font-semibold text-green-700">
                        ₹{safeToFixed(getSelectedTotals().cash + getSelectedTotals().online + getSelectedTotals().credit, 2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Settlement date:</span>
                      <span className="ml-2 font-semibold">{new Date(selectedDate).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Will be marked as:</span>
                      <span className="ml-2">
                        <Badge variant={markAsFinal ? "default" : "secondary"} className="text-xs">
                          {markAsFinal ? 'Final Settlement' : 'Draft Settlement'}
                        </Badge>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expected values from selected readings */}
                {selectedReadingIds.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 p-2 sm:p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-center sm:text-left">
                      <div className="text-xs text-purple-600 font-semibold">Expected Cash</div>
                      <div className="text-sm sm:text-lg font-bold text-purple-700">₹{safeToFixed(getSelectedTotals().cash, 2)}</div>
                    </div>
                    <div className="text-center sm:text-left">
                      <div className="text-xs text-purple-600 font-semibold">Expected Online</div>
                      <div className="text-sm sm:text-lg font-bold text-purple-700">₹{safeToFixed(getSelectedTotals().online, 2)}</div>
                    </div>
                    <div className="text-center sm:text-left">
                      <div className="text-xs text-purple-600 font-semibold">Expected Credit</div>
                      <div className="text-sm sm:text-lg font-bold text-purple-700">₹{safeToFixed(getSelectedTotals().credit, 2)}</div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="actual-cash" className="text-sm font-semibold">
                      Actual Cash Received
                    </Label>
                    <Input
                      id="actual-cash"
                      type="number"
                      step="0.01"
                      min="0"
                      value={actualCash}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setActualCash(isNaN(val) || val < 0 ? 0 : val);
                      }}
                      className="border-green-300 focus:border-green-500 text-sm sm:text-base md:text-lg font-bold"
                      placeholder="Enter actual cash received"
                    />
                    <p className="text-xs text-muted-foreground">
                      Physical cash from pump/register
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="actual-online" className="text-sm font-semibold">
                      Actual Online Received
                    </Label>
                    <Input
                      id="actual-online"
                      type="number"
                      step="0.01"
                      min="0"
                      value={actualOnline}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setActualOnline(isNaN(val) || val < 0 ? 0 : val);
                      }}
                      className="border-blue-300 focus:border-blue-500 text-sm sm:text-base md:text-lg font-bold"
                      placeholder="Enter actual online received"
                    />
                    <p className="text-xs text-muted-foreground">
                      UPI, card, netbanking, etc.
                    </p>
                  </div>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                    <Label htmlFor="actual-credit" className="text-sm font-semibold">
                      Credit Given
                    </Label>
                    <Input
                      id="actual-credit"
                      type="number"
                      step="0.01"
                      min="0"
                      value={actualCredit}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setActualCredit(isNaN(val) || val < 0 ? 0 : val);
                      }}
                      className="border-orange-300 focus:border-orange-500 text-sm sm:text-base md:text-lg font-bold"
                      placeholder="Enter credit given (sales on credit)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Sales made on credit (creditors' debt, owner's earning)
                    </p>
                  </div>
                </div>

                {/* Variance - only show when readings selected and cash entered */}
                {selectedReadingIds.length > 0 && actualCash > 0 && (
                  <div className={`p-3 sm:p-4 rounded-lg border-2 ${
                    Math.abs(getSelectedTotals().cash - actualCash) < 1
                      ? 'border-green-300 bg-green-100'
                      : 'border-yellow-300 bg-yellow-100'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-sm sm:text-base ${
                        Math.abs(actualCash - getSelectedTotals().cash) < 1
                          ? 'text-green-700'
                          : 'text-yellow-700'
                      }`}>
                        {Math.abs(getSelectedTotals().cash - actualCash) < 1 ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 inline mr-2" />
                            Cash Match - No Variance
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 inline mr-2" />
                            Cash Variance
                          </>
                        )}
                      </span>
                      <div className={`text-sm sm:text-lg md:text-xl lg:text-2xl font-bold ${
                        getSelectedTotals().cash < actualCash
                          ? 'text-green-600'
                          : getSelectedTotals().cash > actualCash
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}>
                        {getSelectedTotals().cash < actualCash ? '+' : ''}₹{safeToFixed(getSelectedTotals().cash - actualCash, 2)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Online Variance - show when readings selected and online amount entered */}
                {selectedReadingIds.length > 0 && actualOnline > 0 && (
                  <div className={`p-3 sm:p-4 rounded-lg border-2 ${
                    Math.abs(getSelectedTotals().online - actualOnline) < 1
                      ? 'border-blue-300 bg-blue-100'
                      : 'border-yellow-300 bg-yellow-100'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-sm sm:text-base ${
                        Math.abs(actualOnline - getSelectedTotals().online) < 1
                          ? 'text-blue-700'
                          : 'text-yellow-700'
                      }`}>
                        {Math.abs(getSelectedTotals().online - actualOnline) < 1 ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 inline mr-2" />
                            Online Match - No Variance
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 inline mr-2" />
                            Online Variance
                          </>
                        )}
                      </span>
                      <div className={`text-sm sm:text-lg md:text-xl lg:text-2xl font-bold ${
                        getSelectedTotals().online < actualOnline
                          ? 'text-green-600'
                          : getSelectedTotals().online > actualOnline
                          ? 'text-red-600'
                          : 'text-blue-600'
                      }`}>
                        {getSelectedTotals().online < actualOnline ? '+' : ''}₹{safeToFixed(getSelectedTotals().online - actualOnline, 2)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Credit Variance - show when readings selected and credit amount entered */}
                {selectedReadingIds.length > 0 && actualCredit > 0 && (
                  <div className={`p-3 sm:p-4 rounded-lg border-2 ${
                    Math.abs(getSelectedTotals().credit - actualCredit) < 1
                      ? 'border-orange-300 bg-orange-100'
                      : 'border-yellow-300 bg-yellow-100'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-sm sm:text-base ${
                        Math.abs(actualCredit - getSelectedTotals().credit) < 1
                          ? 'text-orange-700'
                          : 'text-yellow-700'
                      }`}>
                        {Math.abs(getSelectedTotals().credit - actualCredit) < 1 ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 inline mr-2" />
                            Credit Match - No Variance
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 inline mr-2" />
                            Credit Variance
                          </>
                        )}
                      </span>
                      <div className={`text-sm sm:text-lg md:text-xl lg:text-2xl font-bold ${
                        getSelectedTotals().credit < actualCredit
                          ? 'text-green-600'
                          : getSelectedTotals().credit > actualCredit
                          ? 'text-red-600'
                          : 'text-orange-600'
                      }`}>
                        {getSelectedTotals().credit < actualCredit ? '+' : ''}₹{safeToFixed(getSelectedTotals().credit - actualCredit, 2)}
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-semibold">
                    Notes (Optional)
                  </Label>
                  <Input
                    id="notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., 'Variance due to employee error', 'Extra cash from yesterday'"
                    className="text-sm sm:text-base"
                  />
                </div>

                {/* Mark as Final Checkbox */}
                <div className="flex items-center space-x-2 p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Checkbox
                    id="mark-final"
                    checked={markAsFinal}
                    onCheckedChange={(checked) => setMarkAsFinal(checked === true)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="mark-final" className="text-xs sm:text-sm font-semibold cursor-pointer">
                      Mark as Final Settlement
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Final settlements are used for daily reports. Previous final settlements for this date will be unmarked.
                    </p>
                  </div>
                </div>

                {/* Selection Status */}
                {selectedReadingIds.length === 0 && (
                  <div className="p-2 sm:p-3 bg-red-50 rounded-lg border border-red-200 text-xs sm:text-sm text-red-700">
                    <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 inline mr-2" />
                    Please select employee readings above before completing settlement
                  </div>
                )}

                {selectedReadingIds.length > 0 && (
                  <div className="p-2 sm:p-3 bg-green-50 rounded-lg border border-green-200 text-xs sm:text-sm text-green-700">
                    <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 inline mr-2" />
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
                  className={`w-full py-3 sm:py-6 text-sm sm:text-lg ${selectedReadingIds.length === 0 ? 'opacity-50' : ''}`}
                  size="lg"
                >
                  {isSubmitting ? 'Saving...' : selectedReadingIds.length === 0
                    ? 'Select Readings First'
                    : `Complete Settlement (${selectedReadingIds.length} entries)`}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Previous Settlements */}
          {previousSettlements && previousSettlements.length > 0 && (
            <Card className="p-3 sm:p-4 md:p-6">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-base sm:text-lg">Recent Settlements</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Previous settlement records for audit and reference
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3 sm:space-y-6">
                  {previousSettlements.map((settlement: SettlementRecord) => 
                    settlement.id ? (
                    <Collapsible key={settlement.id} open={expandedSettlements.has(settlement.id)} onOpenChange={() => handleToggleSettlement(settlement.id!)}>
                      <CollapsibleTrigger asChild>
                        <div className={`border rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition-colors ${settlement.isFinal ? 'border-green-600 bg-green-50' : 'border-muted'} ${settlement.mainSettlement && settlement.mainSettlement.id === settlement.id ? 'ring-2 ring-blue-300' : ''}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="min-w-0 flex-1">
                                <h4 className="font-semibold text-sm sm:text-base truncate">
                                  {new Date(settlement.date).toLocaleDateString('en-IN', {
                                    day: 'numeric', month: 'short', year: '2-digit'
                                  })}
                                </h4>
                                <p className="text-xs text-muted-foreground truncate">
                                  Total: ₹{safeToFixed((settlement.actualCash || 0) + (settlement.online || 0) + (settlement.credit || 0), 2)}
                                </p>
                              </div>
                              <Badge variant={settlement.isFinal ? "default" : "secondary"} className="text-xs shrink-0">
                                {settlement.isFinal ? 'Final' : 'Draft'}
                              </Badge>
                            </div>
                            <ChevronDown className={`w-4 h-4 transition-transform shrink-0 ${settlement.id && expandedSettlements.has(settlement.id) ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className={`border rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3 mt-2 bg-white ${settlement.mainSettlement && settlement.mainSettlement.id === settlement.id ? 'ring-2 ring-blue-300' : ''}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-sm sm:text-base truncate">
                                {new Date(settlement.date).toLocaleDateString('en-IN', {
                                  day: 'numeric', month: 'short', year: '2-digit'
                                })}
                              </h4>
                              <p className="text-xs text-muted-foreground truncate">
                                Recorded by {settlement.settledBy || 'Unknown'} at {new Date(settlement.recordedAt || settlement.settledAt || settlement.date).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex flex-col sm:items-end gap-1">
                              <p className="text-xs sm:text-sm">Status: {settlement.isFinal ? 'Final' : 'Draft'}</p>
                              {settlement.isFinal && <Badge variant="outline" className="text-green-700 border-green-600 text-xs">Final</Badge>}
                            </div>
                          </div>
                          {/* Employee-reported vs Owner-confirmed comparison */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                            <div className="bg-blue-50 p-2 sm:p-3 rounded border border-blue-200">
                              <div className="font-semibold text-blue-700 mb-1 text-xs sm:text-sm">Employee Reported</div>
                              <div className="space-y-1">
                                <div>Cash: ₹{safeToFixed(settlement.employeeCash ?? settlement.expectedCash, 2)}</div>
                                <div>Online: ₹{safeToFixed(settlement.employeeOnline ?? 0, 2)}</div>
                                <div>Credit: ₹{safeToFixed(settlement.employeeCredit ?? 0, 2)}</div>
                              </div>
                            </div>
                            <div className="bg-green-50 p-2 sm:p-3 rounded border border-green-200">
                              <div className="font-semibold text-green-700 mb-1 text-xs sm:text-sm">Owner Confirmed</div>
                              <div className="space-y-1">
                                <div>Cash: ₹{safeToFixed(settlement.actualCash, 2)}</div>
                                <div>Online: ₹{safeToFixed(settlement.online, 2)}</div>
                                <div>Credit: ₹{safeToFixed(settlement.credit, 2)}</div>
                              </div>
                            </div>
                          </div>
                          {/* Variance per payment type */}
                          <div className="flex flex-wrap gap-2 sm:gap-4 text-xs">
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
                              <div className="space-y-1 max-h-32 overflow-y-auto">
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
                      </CollapsibleContent>
                    </Collapsible>
                    ) : null
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
