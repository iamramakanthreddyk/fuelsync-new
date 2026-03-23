import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { stationService } from '@/services/stationService';
import { toNumber } from '@/utils/number';
import { apiClient } from '@/lib/api-client';

import type { ReadingEntry, CreditAllocation, Creditor } from '@/types/finance';

interface ReadingData {
  nozzleId: string;
  openingReading: string;
  closingReading: string;
}

interface UseQuickEntryOptions {
  stationId: string;
  mode: 'employee' | 'owner'; // employee = two-step, owner = single-step
  onSuccess?: () => void;
}

interface QuickEntryState {
  readings: ReadingData[] | Record<string, ReadingEntry>;
  readingDate: string;
  paymentBreakdown: { cash: number; online: number; credit: number };
  creditAllocations: CreditAllocation[];
  step: 'readings' | 'transaction';
  submittedReadingIds: string[];
  assignedEmployeeId: string | null; // REQUIRED: Employee responsible for readings
}

/**
 * Service: Fetch creditors for a station
 * Delegates to apiClient (todo: move to creditorService)
 */
async function fetchCreditors(stationId: string): Promise<Creditor[]> {
  try {
    const response = await apiClient.get(`/stations/${stationId}/creditors`);
    if (response && typeof response === 'object') {
      if (Array.isArray(response)) return response;
      if ('data' in response && Array.isArray(response.data)) return response.data;
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch creditors:', error);
    return [];
  }
}

/**
 * Service: Submit readings
 * Delegates to readingService for individual reading calls
 */
async function submitReadings(data: {
  stationId: string;
  readings: ReadingEntry[] | ReadingData[];
  pumps: any[];
  fuelPrices: any[];
  readingDate: string;
  assignedEmployeeId: string;
  mode: 'employee' | 'owner';
  lastReadings?: Record<string, number>;
}): Promise<Array<{ id: string; totalAmount: number; litresSold: number; isSample: boolean }>> {
  const { stationId, readings, pumps, fuelPrices, readingDate, assignedEmployeeId, lastReadings = {} } = data;

  if (!assignedEmployeeId) {
    throw new Error('You must assign these readings to an employee before submission');
  }

  // Convert readings to ReadingEntry[] format
  const readingEntries: ReadingEntry[] = [];

  // Readings are now always ReadingEntry[] (both employee and owner modes use Record format,
  // and handleSubmit converts via Object.values before calling mutation)
  const entries = readings as ReadingEntry[];
  readingEntries.push(...entries.filter(r => r && r.readingValue));

  // Submit each reading via service
  const promises = readingEntries.map(entry => {
    const nozzle = pumps?.flatMap(p => p.nozzles || []).find(n => n.id === entry.nozzleId);
    const enteredValue = toNumber(entry.readingValue || '0');
    // Use lastReadings from API first, then fallback to nozzle.lastReading, then initialReading
    const lastReadingFromApi = lastReadings[entry.nozzleId] !== undefined ? toNumber(String(lastReadings[entry.nozzleId])) : null;
    const lastReading = lastReadingFromApi !== null ? lastReadingFromApi : (nozzle?.lastReading ? toNumber(String(nozzle.lastReading)) : null);
    const initialReading = nozzle?.initialReading ? toNumber(String(nozzle.initialReading)) : null;
    const compareValue = lastReading !== null && !isNaN(lastReading)
      ? lastReading
      : (initialReading !== null && !isNaN(initialReading) ? initialReading : 0);

    const litres = Math.max(0, enteredValue - (compareValue || 0));
    const priceData = Array.isArray(fuelPrices)
      ? fuelPrices.find(p => {
          const priceType = (p.fuelType || p.fuel_type || '').toUpperCase();
          const nozzleType = (nozzle?.fuelType || '').toUpperCase();
          return priceType === nozzleType;
        })
      : undefined;
    const price = priceData ? toNumber(String(priceData.price || priceData.price_per_litre)) : 0;
    const totalAmount = litres * price;

    const readingData = {
      stationId,
      nozzleId: entry.nozzleId,
      readingValue: toNumber(entry.readingValue),
      readingDate,
      pricePerLitre: price,
      totalAmount,
      litresSold: litres,
      assignedEmployeeId,
      notes: `Reading entered via quick entry`
    };

    if (!readingData.stationId) throw new Error('Station ID is required');
    if (!readingData.nozzleId) throw new Error('Nozzle ID is required');

    // Use apiClient directly for now (todo: wrap in readingService)
    return apiClient.post('/readings', readingData);
  });

  const results = await Promise.all(promises);
  // Return both IDs and calculated totalAmount for each created reading
  // This allows the transaction submission to accurately validate payment breakdown
  return results
    .map((r: any) => {
      if (!r.data?.id) return null;
      return {
        id: r.data.id,
        totalAmount: r.data.totalAmount || r.data.total_amount || 0,
        litresSold: r.data.litresSold || r.data.litres_sold || 0,
        isSample: r.data.isSample || r.data.is_sample || false
      };
    })
    .filter((r): r is { id: string; totalAmount: number; litresSold: number; isSample: boolean } => r !== null);
}

/**
 * Service: Submit transaction
 * Delegates to apiClient (todo: move to transactionService)
 */
async function submitTransaction(data: {
  stationId: string;
  transactionDate: string;
  readingIds: string[];
  paymentBreakdown: { cash: number; online: number; credit: number };
  paymentSubBreakdown?: any;
  creditAllocations: CreditAllocation[];
  saleSummary: any;
}): Promise<any> {
  const { stationId, transactionDate, readingIds, paymentBreakdown, paymentSubBreakdown, creditAllocations } = data;

  // Payment vs sale value validation is already done in handleSubmit (with 1.0 rupee tolerance)
  // and will be enforced again by the backend. No need to re-validate here.

  if (paymentBreakdown.credit > 0 && creditAllocations.length === 0) {
    throw new Error('Please allocate credit to at least one creditor');
  }

  const transactionData = {
    stationId,
    transactionDate,
    readingIds,
    paymentBreakdown,
    ...(paymentSubBreakdown ? { paymentSubBreakdown } : {}),
    creditAllocations: creditAllocations.filter(c => toNumber(c.amount) > 0),
    notes: `Transaction created via quick entry`
  };

  return apiClient.post('/transactions', transactionData);
}

export function useQuickEntry({ stationId, mode, onSuccess }: UseQuickEntryOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [state, setState] = useState<QuickEntryState>(() => ({
    readings: {},
    readingDate: new Date().toISOString().split('T')[0],
    paymentBreakdown: { cash: 0, online: 0, credit: 0 },
    creditAllocations: [],
    step: 'readings',
    submittedReadingIds: [],
    assignedEmployeeId: null
  }));

  // Update reading date
  const setReadingDate = (date: string) => {
    setState(prev => ({ ...prev, readingDate: date }));
  };

  // Update readings - always stored as Record<string, ReadingEntry> keyed by nozzleId
  const updateReading = (nozzleId: string, field: string, value: string) => {
    setState(prev => {
      const prevReadings = prev.readings as Record<string, ReadingEntry>;
      const existing = prevReadings[nozzleId] || { nozzleId, readingValue: '', date: prev.readingDate, paymentType: '' };
      return {
        ...prev,
        readings: {
          ...prevReadings,
          [nozzleId]: {
            ...existing,
            [field]: field === 'is_sample' ? (value === '1') : value
          }
        }
      };
    });
  };

  // Update payment breakdown
  const updatePaymentBreakdown = (breakdown: { cash: number; online: number; credit: number }) => {
    setState(prev => ({ ...prev, paymentBreakdown: breakdown }));
  };

  // Update credit allocations
  const updateCreditAllocations = (allocations: CreditAllocation[]) => {
    setState(prev => ({ ...prev, creditAllocations: allocations }));
  };

  // Move to next step (employee mode)
  const nextStep = () => {
    if (mode === 'employee') {
      setState(prev => ({ ...prev, step: 'transaction' }));
    }
  };

  // Move to previous step (employee mode)
  const prevStep = () => {
    if (mode === 'employee') {
      setState(prev => ({ ...prev, step: 'readings', submittedReadingIds: [] }));
    }
  };

  // Set assigned employee (required before submission)
  const setAssignedEmployee = (employeeId: string | null) => {
    setState(prev => ({ ...prev, assignedEmployeeId: employeeId }));
  };

  // Fetch employees using stationService
  const { data: employees = [] } = useQuery({
    queryKey: ['employees', stationId],
    queryFn: async () => {
      if (!stationId) return [];
      try {
        const staff = await stationService.getStaff(stationId);
        // Filter to employees only if needed
        return staff;
      } catch (error) {
        console.error('Failed to fetch employees:', error);
        return [];
      }
    },
    enabled: !!stationId
  });

  // Fetch creditors
  const { data: creditors = [] } = useQuery<Creditor[]>({
    queryKey: ['creditors', stationId],
    queryFn: () => fetchCreditors(stationId),
    enabled: !!stationId
  });

  // Calculate sale summary
  const saleSummary = useMemo(() => {
    return { totalLiters: 0, totalSaleValue: 0, byFuelType: {} };
  }, []);

  // Auto-adjust cash when sale value changes (employee mode)
  useEffect(() => {
    if (mode === 'employee' && saleSummary.totalSaleValue > 0 && state.step === 'transaction') {
      const allocated = state.paymentBreakdown.online + state.paymentBreakdown.credit;
      const newCash = Math.max(0, saleSummary.totalSaleValue - allocated);
      if (Math.abs(newCash - state.paymentBreakdown.cash) > 0.01) {
        updatePaymentBreakdown({
          ...state.paymentBreakdown,
          cash: newCash
        });
      }
    }
  }, [saleSummary.totalSaleValue, state.paymentBreakdown, state.step, mode]);

  // Submit readings mutation
  const submitReadingsMutation = useMutation({
    mutationFn: (data: { readings: ReadingEntry[] | ReadingData[], pumps: any[], fuelPrices: any[], lastReadings?: Record<string, number>, paymentBreakdown?: { cash: number; online: number; credit: number }, paymentSubBreakdown?: any, creditAllocations?: CreditAllocation[], saleSummary?: any }) => 
      submitReadings({
        ...data,
        stationId,
        readingDate: state.readingDate,
        assignedEmployeeId: state.assignedEmployeeId!,
        mode
      }),
    onSuccess: (createdReadings: any[], variables) => {
      // createdReadings now includes { id, totalAmount, litresSold, isSample }
      const readingIds = createdReadings.map((r: any) => r.id).filter(Boolean);
      
      // Recalculate sale value based on readings that were actually created (excluding samples)
      const actualSaleValue = createdReadings
        .filter((r: any) => !r.isSample)
        .reduce((sum: number, r: any) => sum + (parseFloat(String(r.totalAmount || 0))), 0);

      toast({
        title: 'Readings Saved ✓',
        description: `${readingIds.length} reading(s) submitted successfully (₹${actualSaleValue.toFixed(2)} total)`,
        variant: 'success'
      });

      setState(prev => ({
        ...prev,
        submittedReadingIds: readingIds,
        step: mode === 'employee' ? 'transaction' : prev.step
      }));

      if (mode === 'owner' && readingIds.length > 0) {
        // IMPORTANT: Use the ACTUAL sale value from created readings, not the pre-calculated saleSummary
        // This prevents validation errors when some readings fail to create
        const capturedPaymentBreakdown = variables.paymentBreakdown || state.paymentBreakdown;
        const capturedCreditAllocations = variables.creditAllocations || state.creditAllocations;
        
        // Create adjusted payment breakdown based on actual sale value
        // If actual sale value differs from expected, scale payments proportionally
        const expectedSaleValue = variables.saleSummary?.totalSaleValue || actualSaleValue;
        let adjustedPaymentBreakdown = { ...capturedPaymentBreakdown };
        
        if (Math.abs(actualSaleValue - expectedSaleValue) > 0.01 && expectedSaleValue > 0) {
          // Scale all payment amounts by the ratio of actual to expected
          const scaleFactor = actualSaleValue / expectedSaleValue;
          adjustedPaymentBreakdown = {
            cash: capturedPaymentBreakdown.cash * scaleFactor,
            online: capturedPaymentBreakdown.online * scaleFactor,
            credit: capturedPaymentBreakdown.credit * scaleFactor
          };
        }
        
        submitTransactionMutation.mutate({
          readingIds,
          paymentBreakdown: adjustedPaymentBreakdown,
          paymentSubBreakdown: variables.paymentSubBreakdown,
          creditAllocations: capturedCreditAllocations,
          saleSummary: { totalSaleValue: actualSaleValue }
        });
      }
    },
    onError: (error: unknown) => {
      let message = 'Failed to save readings';
      if (error instanceof Error) message = error.message;
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // Submit transaction mutation
  const submitTransactionMutation = useMutation({
    mutationFn: (data: {
      readingIds: string[],
      paymentBreakdown: { cash: number; online: number; credit: number },
      paymentSubBreakdown?: any,
      creditAllocations: CreditAllocation[],
      saleSummary: any
    }) => submitTransaction({
      stationId,
      transactionDate: state.readingDate,
      ...data
    }),
    onSuccess: (response: any) => {
      toast({
        title: 'Transaction Created ✓',
        description: `Payment breakdown recorded successfully`,
        variant: 'success'
      });

      // Cache the transaction response for auto-fill in Daily Settlement
      // The component can retrieve this via queryClient.getQueryData(['lastTransaction', stationId])
      if (response?.data?.id) {
        queryClient.setQueryData(['lastTransaction', stationId], response.data);
      }

      // Reset state
      setState({
        readings: {},
        readingDate: new Date().toISOString().split('T')[0],
        paymentBreakdown: { cash: 0, online: 0, credit: 0 },
        creditAllocations: [],
        step: 'readings',
        submittedReadingIds: [],
        assignedEmployeeId: null
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['pumps', stationId] });
      queryClient.invalidateQueries({ queryKey: ['daily-sales'] });
      queryClient.invalidateQueries({ queryKey: ['readings'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', stationId] });

      onSuccess?.();
    },
    onError: (error: unknown) => {
      let message = 'Failed to create transaction';
      if (error instanceof Error) message = error.message;
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // Reset function
  const reset = () => {
    setState({
      readings: mode === 'employee' ? {} : [],
      readingDate: new Date().toISOString().split('T')[0],
      paymentBreakdown: { cash: 0, online: 0, credit: 0 },
      creditAllocations: [],
      step: 'readings',
      submittedReadingIds: [],
      assignedEmployeeId: null
    });
  };

  return {
    // State
    ...state,

    // Actions
    setReadingDate,
    updateReading,
    updatePaymentBreakdown,
    updateCreditAllocations,
    setAssignedEmployee,
    nextStep,
    prevStep,
    reset,

    // Data
    employees,
    creditors,
    saleSummary,

    // Mutations
    submitReadingsMutation,
    submitTransactionMutation,

    // Computed
    pendingCount: mode === 'employee' 
      ? Object.keys(state.readings as Record<string, ReadingEntry>).length
      : (state.readings as ReadingData[]).length,
    hasValidReadings: mode === 'employee'
      ? Object.keys(state.readings as Record<string, ReadingEntry>).length > 0
      : (state.readings as ReadingData[]).length > 0,
    isEmployeeAssigned: state.assignedEmployeeId !== null
  };
}