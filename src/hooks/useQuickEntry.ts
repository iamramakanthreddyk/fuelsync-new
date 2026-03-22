import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { stationService } from '@/services/stationService';
import { toNumber } from '@/utils/number';
import { safeToFixed } from '@/lib/format-utils';
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
}): Promise<string[]> {
  const { stationId, readings, pumps, fuelPrices, readingDate, assignedEmployeeId, mode } = data;

  if (!assignedEmployeeId) {
    throw new Error('You must assign these readings to an employee before submission');
  }

  // Convert readings to ReadingEntry[] format
  const readingEntries: ReadingEntry[] = [];

  if (mode === 'employee') {
    readingEntries.push(...(readings as ReadingEntry[]));
  } else {
    const readingDataArray = readings as ReadingData[];
    readingDataArray.forEach(reading => {
      if (reading.openingReading && reading.closingReading) {
        readingEntries.push({
          nozzleId: reading.nozzleId,
          readingValue: reading.closingReading,
          date: readingDate,
          paymentType: ''
        });
      }
    });
  }

  // Submit each reading via service
  const promises = readingEntries.map(entry => {
    const nozzle = pumps?.flatMap(p => p.nozzles || []).find(n => n.id === entry.nozzleId);
    const enteredValue = toNumber(entry.readingValue || '0');
    const lastReading = nozzle?.lastReading ? toNumber(String(nozzle.lastReading)) : null;
    const initialReading = nozzle?.initialReading ? toNumber(String(nozzle.initialReading)) : null;
    const compareValue = lastReading !== null && !isNaN(lastReading)
      ? lastReading
      : (initialReading !== null && !isNaN(initialReading) ? initialReading : 0);

    const litres = Math.max(0, enteredValue - (compareValue || 0));
    const priceData = Array.isArray(fuelPrices)
      ? fuelPrices.find(p => p.fuelType.toUpperCase() === (nozzle?.fuelType || '').toUpperCase())
      : undefined;
    const price = priceData ? toNumber(String(priceData.price)) : 0;
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
  return results.map((r: any) => r.data?.id).filter(Boolean);
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
  creditAllocations: CreditAllocation[];
  saleSummary: any;
}): Promise<any> {
  const { stationId, transactionDate, readingIds, paymentBreakdown, creditAllocations, saleSummary } = data;
  const totalPayment = paymentBreakdown.cash + paymentBreakdown.online + paymentBreakdown.credit;

  if (Math.abs(totalPayment - saleSummary.totalSaleValue) > 0.01) {
    throw new Error(
      `Total payment (₹${safeToFixed(totalPayment, 2)}) must match sale value (₹${safeToFixed(saleSummary.totalSaleValue, 2)})`
    );
  }

  if (paymentBreakdown.credit > 0 && creditAllocations.length === 0) {
    throw new Error('Please allocate credit to at least one creditor');
  }

  const transactionData = {
    stationId,
    transactionDate,
    readingIds,
    paymentBreakdown,
    creditAllocations: creditAllocations.filter(c => toNumber(c.amount) > 0),
    notes: `Transaction created via quick entry`
  };

  return apiClient.post('/transactions', transactionData);
}

export function useQuickEntry({ stationId, mode, onSuccess }: UseQuickEntryOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [state, setState] = useState<QuickEntryState>(() => ({
    readings: mode === 'employee' ? {} : [],
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

  // Update readings
  const updateReading = (nozzleId: string, field: string, value: string) => {
    setState(prev => {
      if (mode === 'employee') {
        if (field === 'readingValue') {
          return {
            ...prev,
            readings: {
              ...(prev.readings as Record<string, ReadingEntry>),
              [nozzleId]: {
                nozzleId,
                readingValue: value,
                date: prev.readingDate,
                paymentType: ''
              }
            }
          };
        }
      } else {
        const readings = prev.readings as ReadingData[];
        const existingIndex = readings.findIndex(r => r.nozzleId === nozzleId);
        
        if (existingIndex >= 0) {
          const updatedReadings = [...readings];
          updatedReadings[existingIndex] = {
            ...updatedReadings[existingIndex],
            [field]: value
          };
          return { ...prev, readings: updatedReadings };
        } else {
          const newReading: ReadingData = {
            nozzleId,
            openingReading: field === 'openingReading' ? value : '',
            closingReading: field === 'closingReading' ? value : ''
          };
          return {
            ...prev,
            readings: [...readings, newReading]
          };
        }
      }
      return prev;
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
    mutationFn: (data: { readings: ReadingEntry[] | ReadingData[], pumps: any[], fuelPrices: any[] }) => 
      submitReadings({
        ...data,
        stationId,
        readingDate: state.readingDate,
        assignedEmployeeId: state.assignedEmployeeId!,
        mode
      }),
    onSuccess: (readingIds) => {
      toast({
        title: 'Readings Saved ✓',
        description: `${readingIds.length} reading(s) submitted successfully`,
        variant: 'success'
      });

      setState(prev => ({
        ...prev,
        submittedReadingIds: readingIds,
        step: mode === 'employee' ? 'transaction' : prev.step
      }));

      if (mode === 'owner') {
        submitTransactionMutation.mutate({
          readingIds,
          paymentBreakdown: state.paymentBreakdown,
          creditAllocations: state.creditAllocations,
          saleSummary
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
      creditAllocations: CreditAllocation[],
      saleSummary: any
    }) => submitTransaction({
      stationId,
      transactionDate: state.readingDate,
      ...data
    }),
    onSuccess: () => {
      toast({
        title: 'Transaction Created ✓',
        description: `Payment breakdown recorded successfully`,
        variant: 'success'
      });

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