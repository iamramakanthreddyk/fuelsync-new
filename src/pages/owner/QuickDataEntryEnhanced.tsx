import { toNumber } from '@/utils/number';

/**
 * Quick Data Entry with Sale Calculations - Enhanced for Owners
 * Enhanced version with per-nozzle sale value calculations
 * Now using shared components for DRY principle
 *
 * READING ENTRY FLOW:
 * 1. Owner enters the CLOSING READING (current meter value on pump)
 * 2. System fetches the OPENING READING (previous meter reading)
 * 3. System calculates LITRES SOLD = closingReading - openingReading
 * 4. System fetches FUEL PRICE for the date
 * 5. System calculates SALE VALUE = litresSold × fuelPrice
 * 6. Owner allocates payment (cash/online/credit)
 * 7. Backend saves reading with all calculated values
 *
 * IMPORTANT TERMINOLOGY:
 * - openingReading = lastReading (previous recorded meter value)
 * - closingReading = readingValue (meter value entered now)
 * - litresSold = calculated difference
 * - saleValue = totalAmount (calculated sale revenue)
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ReadingInput } from '@/components/ui/ReadingInput';
import { RoleBadge } from '@/components/ui/RoleBadge';
import { Check } from 'lucide-react';
import { getFuelBadgeClasses } from '@/lib/fuelColors';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { useStations, usePumps } from '@/hooks/api';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useFuelPricesForStation } from '@/hooks/useFuelPricesForStation';
import { useFuelPricesGlobal } from '@/context/FuelPricesContext';
import { safeToFixed } from '@/lib/format-utils';
import { PaymentMethodEnum, EquipmentStatusEnum } from '@/core/enums';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import {
  Zap,
  Building2,
  Fuel,
  AlertTriangle,
  Plus,
  X,
  Trash2
} from 'lucide-react';

import type {
  ReadingEntry,
  CreditAllocation,
  PaymentAllocation,
  Creditor
} from '@/types/finance';

// Utility function to calculate litres and sale value for a nozzle
const calculateNozzleSale = (nozzle: any, readingValue: string, lastReading: number | null, fuelPrices: any[]) => {
  const enteredValue = toNumber(readingValue || '0');
  const nozzleLast = nozzle?.lastReading !== undefined && nozzle?.lastReading !== null ? toNumber(String(nozzle.lastReading)) : undefined;
  const initial = nozzle?.initialReading !== undefined && nozzle?.initialReading !== null ? toNumber(String(nozzle.initialReading)) : 0;
  let last: number | undefined = undefined;
  if (lastReading !== null && lastReading !== undefined) {
    last = Number(lastReading);
  } else if (nozzleLast !== undefined) {
    last = nozzleLast;
  } else if (initial !== undefined) {
    last = initial;
  }
  if (last === undefined || isNaN(last)) {
    return { litres: 0, saleValue: 0 };
  }
  const litres = Math.max(0, enteredValue - last);
  // Safety check: ensure fuelPrices is an array before calling .find()
  const pricesArray = Array.isArray(fuelPrices) ? fuelPrices : [];
  const priceData = pricesArray.find(p => (p.fuel_type || '').toUpperCase() === (nozzle?.fuelType || '').toUpperCase());
  const price = toNumber(String(priceData?.price_per_litre || 0));
  const saleValue = litres * price;
  return { litres, saleValue };
}

export default function QuickDataEntryEnhanced() {
  const { user } = useAuth();
  const { stations: userStations } = useRoleAccess();
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [readings, setReadings] = useState<Record<string, ReadingEntry>>({});
  const [readingDate, setReadingDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAllocation, setPaymentAllocation] = useState<PaymentAllocation>({
    cash: '0',
    online: '0',
    credits: []
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get fuel prices context
  const { setStationId } = useFuelPricesGlobal();

  // Fetch stations
  const { data: stationsResponse } = useStations();
  const stations = stationsResponse?.data;

  // Determine if user can select stations (owners/managers) or is auto-assigned (employees)
  const canSelectStation = user?.role === 'owner' || user?.role === 'manager';
  const isEmployee = user?.role === 'employee';
  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager';

  // Auto-select station based on role
  useEffect(() => {
    if (!stations || stations.length === 0) return;

    if (isEmployee) {
      // Employees are assigned to ONE station - auto-select it
      const employeeStation = user?.stationId || userStations?.[0]?.id || '';
      if (employeeStation && !selectedStation) {
        setSelectedStation(employeeStation);
      }
    } else if (canSelectStation && !selectedStation) {
      // Owners/Managers: auto-select first available station
      setSelectedStation(stations[0].id);
    }
  }, [stations, selectedStation, isEmployee, canSelectStation, user?.stationId, userStations]);

  // Update context when selected station changes (loads prices for that station)
  useEffect(() => {
    if (selectedStation) {
      setStationId(selectedStation);
    }
  }, [selectedStation, setStationId]);

  // Fetch pumps for selected station
  const { data: pumpsResponse, isLoading: pumpsLoading } = usePumps(selectedStation);
  const pumps = pumpsResponse?.data || (Array.isArray(pumpsResponse) ? pumpsResponse : null);

  // Get fuel prices for selected station from global context (preloaded on app init)
  const { missingFuelTypes: missingPricesFuelTypes = [], pricesArray = [] } = useFuelPricesForStation(selectedStation);
  // Convert to array format for compatibility with existing code
  const fuelPrices = useMemo(() => Array.isArray(pricesArray) ? pricesArray : [], [pricesArray]);

  // Fetch true last readings for all nozzles to use in payment allocation calculation
  const { data: allLastReadings, isLoading: allLastReadingsIsLoading } = useQuery({
    queryKey: ['allNozzleLastReadings', selectedStation],
    queryFn: async () => {
      if (!selectedStation || !pumps) return {};
      const nozzleIds = pumps.flatMap(p => p.nozzles || []).map((n: any) => n.id);
      if (nozzleIds.length === 0) return {};
      try {
        const idsParam = nozzleIds.join(',');
        const res: any = await apiClient.get(`/readings/latest?ids=${encodeURIComponent(idsParam)}`);
        // Backend returns: { success: true, data: { [nozzleId]: readingValue } }
        return res?.data || {};
      } catch (err) {
        return {};
      }
    },
    enabled: !!selectedStation && !!pumps
  });

  // Fetch creditors for selected station
  const { data: creditors = [] } = useQuery<Creditor[]>({
    queryKey: ['creditors', selectedStation],
    queryFn: async () => {
      if (!selectedStation) return [];
      try {
        const response = await apiClient.get(`/stations/${selectedStation}/creditors`);
        // Handle response format: { success, data: [...], pagination }
        if (response && typeof response === 'object') {
          if (Array.isArray(response)) {
            return response;
          }
          if ('data' in response && Array.isArray(response.data)) {
            return response.data;
          }
        }
        return [];
      } catch (error) {
        return [];
      }
    },
    enabled: !!selectedStation
  });

  // Calculate sale value summary for current entry (for validation only)
  const saleSummary = useMemo(() => {
    let totalLiters = 0;
    let totalSaleValue = 0;
    const byFuelType: Record<string, { liters: number; value: number }> = {};

    // Only consider readings that are currently entered and valid (unique nozzle IDs)
    const pumpsArray = Array.isArray(pumps) ? pumps : [];
    if (pumpsArray.length > 0 && Array.isArray(fuelPrices)) {

      // Build a set of valid nozzle IDs from the current pumps
      const validNozzleIds = new Set(
        pumpsArray.flatMap(pump => (pump.nozzles ? pump.nozzles.map((nz: any) => nz.id) : []))
      );
      // Only process readings for valid, unique nozzle IDs
      Object.entries(readings).forEach(([nozzleId, reading]) => {
        if (!validNozzleIds.has(nozzleId)) return;
        if (!reading || !reading.readingValue) return;
        // Skip sample readings - they don't contribute to sale value
        if (reading.is_sample) return;
        // Find the nozzle object
        const nozzle = pumpsArray.flatMap(p => p.nozzles || []).find((nz: any) => nz.id === nozzleId);
        if (!nozzle) return;
        // Match UI logic for last reading (compareValue)
        const initialReading = nozzle.initialReading ? parseFloat(String(nozzle.initialReading)) : null;
        const trueLastReading = allLastReadings ? allLastReadings[nozzle.id] : undefined;
        const parsedLastReading = (trueLastReading !== null && trueLastReading !== undefined) ? parseFloat(String(trueLastReading)) : null;
        const compareValue = (parsedLastReading !== null && !isNaN(parsedLastReading))
          ? parsedLastReading
          : (initialReading !== null && !isNaN(initialReading) ? initialReading : 0);

        const enteredValue = reading?.readingValue ? parseFloat(reading.readingValue) : 0;
        // Only count if enteredValue > compareValue (valid sale)
        if (
          isNaN(compareValue) ||
          isNaN(enteredValue) ||
          enteredValue <= compareValue
        ) {
          return;
        }
        const litres = Math.max(0, enteredValue - compareValue);
        // Safety check: ensure fuelPrices is an array before calling .find()
        const pricesArray = Array.isArray(fuelPrices) ? fuelPrices : [];
        const priceData = pricesArray.find(p => (p.fuel_type || '').toUpperCase() === (nozzle?.fuelType || '').toUpperCase());
        const price = toNumber(String(priceData?.price_per_litre || 0));
        const saleValue = litres * price;
        totalLiters += litres;
        totalSaleValue += saleValue;
        if (!byFuelType[nozzle.fuelType]) {
          byFuelType[nozzle.fuelType] = { liters: 0, value: 0 };
        }
        byFuelType[nozzle.fuelType].liters += litres;
        byFuelType[nozzle.fuelType].value += saleValue;
      });
    }

    return {
      totalLiters,
      totalSaleValue,
      byFuelType
    };
  }, [readings, pumps, fuelPrices, allLastReadings]);

  // Calculate payment allocation match status
  const paymentMatchStatus = useMemo(() => {
    const nonSampleEntries = Object.values(readings).filter(r => r.readingValue && parseFloat(r.readingValue) > 0 && !r.is_sample);
    
    // If no non-sample readings, payment allocation is not required
    if (nonSampleEntries.length === 0) {
      return { isMatched: true, allocated: 0, required: 0, difference: 0 };
    }

    const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + toNumber(c.amount), 0);
    const allocated = toNumber(paymentAllocation.cash) + toNumber(paymentAllocation.online) + totalCredit;
    const required = saleSummary.totalSaleValue;
    const difference = allocated - required;

    return {
      isMatched: Math.abs(difference) <= 0.01,
      allocated,
      required,
      difference
    };
  }, [readings, paymentAllocation, saleSummary.totalSaleValue]);

  // Calculate non-sample readings count for UI logic
  const nonSampleReadings = useMemo(() => {
    return Object.values(readings).filter(r => r.readingValue && parseFloat(r.readingValue) > 0 && !r.is_sample);
  }, [readings]);

  // Calculate total readings with values (for submit button logic)
  const readingsWithValues = useMemo(() => {
    return Object.values(readings).filter(r => r.readingValue && parseFloat(r.readingValue) > 0);
  }, [readings]);

  // Initial payment allocation setup (only when completely empty)
  useEffect(() => {
    const totalSaleValue = saleSummary.totalSaleValue;
    const currentTotal =
      toNumber(paymentAllocation.cash) +
      toNumber(paymentAllocation.online) +
      paymentAllocation.credits.reduce((s, c) => s + toNumber(c.amount), 0);

    // Only set initial allocation if everything is empty and we have sales
    if (totalSaleValue > 0 && currentTotal === 0 && paymentAllocation.cash === '0' && paymentAllocation.online === '0' && paymentAllocation.credits.length === 0) {
      setPaymentAllocation({ cash: totalSaleValue.toString(), online: '0', credits: [] });
    }
  }, [saleSummary.totalSaleValue]);

  // Fetch backend stats for today's sales (reactive to selectedStation)
  const { data: dashboardData } = useDashboardData(selectedStation);

  // Default payment allocation: add sale value to cash when sale increases
  const prevSaleValueRef = useRef<number>(0);
  useEffect(() => {
    const newTotalSaleValue = saleSummary.totalSaleValue;
    const prevSaleValue = prevSaleValueRef.current;

    // Only adjust when sale value increases
    if (newTotalSaleValue > prevSaleValue) {
      const increase = newTotalSaleValue - prevSaleValue;
      const currentCash = toNumber(paymentAllocation.cash);
      const newCash = currentCash + increase;

      setPaymentAllocation(prev => ({
        ...prev,
        cash: newCash.toString()
      }));
    }

    // Update the ref with the new sale value
    prevSaleValueRef.current = newTotalSaleValue;
  }, [saleSummary.totalSaleValue]);

  // Submit readings mutation
  const submitReadingsMutation = useMutation({
    mutationFn: async (data: ReadingEntry[]) => {
      // Separate sample and non-sample readings
      const nonSampleReadings = data.filter(r => !r.is_sample);

      // Validate payment allocation for all users when there are non-sample readings
      if (nonSampleReadings.length > 0) {
        const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + toNumber(c.amount), 0);
        const totalPayment = toNumber(paymentAllocation.cash) + toNumber(paymentAllocation.online) + totalCredit;

        if (totalPayment === 0) {
          throw new Error(
            `Payment required: At least one payment method (cash, online, or credit) must be greater than 0 for sale value ₹${safeToFixed(saleSummary.totalSaleValue, 2)}`
          );
        }

        if (totalPayment > saleSummary.totalSaleValue) {
          throw new Error(
            `Total payment (₹${safeToFixed(totalPayment, 2)}) cannot exceed sale value (₹${safeToFixed(saleSummary.totalSaleValue, 2)})`
          );
        }
        if (Math.abs(totalPayment - saleSummary.totalSaleValue) > 0.01) {
          throw new Error(
            `Total payment (₹${safeToFixed(totalPayment, 2)}) must match sale value (₹${safeToFixed(saleSummary.totalSaleValue, 2)})`
          );
        }
      }

      // Build per-entry sale values so we can distribute payments proportionally
      // Note: Sample readings don't contribute to payment allocation but are still submitted
      const entriesWithSale = data.map(entry => {
        const nozzle = pumps?.flatMap(p => p.nozzles || []).find((n: any) => n.id === entry.nozzleId);
        const trueLastReading = allLastReadings ? allLastReadings[entry.nozzleId] : undefined;
        const lastReading = (trueLastReading !== undefined && trueLastReading !== null)
          ? trueLastReading
          : (nozzle?.initialReading || 0);
        const { saleValue } = calculateNozzleSale(nozzle, entry.readingValue, lastReading, fuelPrices);
        // Sample readings don't count toward sale value for payment allocation
        const finalSaleValue = entry.is_sample ? 0 : saleValue;
        return { entry, saleValue: finalSaleValue, actualSaleValue: saleValue };
      });

      const totalSale = entriesWithSale.reduce((s: number, e: any) => s + e.saleValue, 0);
      const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

      const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + toNumber(c.amount), 0);
      const cashRatio = totalSale > 0 ? (toNumber(paymentAllocation.cash) / totalSale) : 0;
      const onlineRatio = totalSale > 0 ? (toNumber(paymentAllocation.online) / totalSale) : 0;
      // For credit, distribute proportionally if multiple creditors
      // We'll use the first credit allocation for each reading for now (can be improved for per-reading split)

      let allocatedCash = 0, allocatedOnline = 0;
      const readingsPayload: Array<{ nozzleId: string; readingValue: number; readingDate: string; isSample: boolean; notes: string }> = [];

      entriesWithSale.forEach((item, idx) => {
        const isLast = idx === entriesWithSale.length - 1;
        let cashAmt = round2(item.saleValue * cashRatio);
        let onlineAmt = round2(item.saleValue * onlineRatio);
        const creditAmts: CreditAllocation[] = [];

        if (isLast) {
          cashAmt = round2(toNumber(paymentAllocation.cash) - allocatedCash);
          onlineAmt = round2(toNumber(paymentAllocation.online) - allocatedOnline);
        }

        allocatedCash = round2(allocatedCash + cashAmt);
        allocatedOnline = round2(allocatedOnline + onlineAmt);

        // Distribute credit among creditors proportionally for each reading
        let creditTotal = 0;
        if (totalCredit > 0) {
          paymentAllocation.credits.forEach((creditAlloc, cidx) => {
            const allocAmount = toNumber(creditAlloc.amount);
            let amt = round2(item.saleValue * (allocAmount / totalCredit));
            if (isLast && cidx === paymentAllocation.credits.length - 1) {
              amt = round2(allocAmount - creditTotal);
            }
            creditTotal += amt;
            if (amt > 0) {
              creditAmts.push({ creditorId: creditAlloc.creditorId, amount: amt.toString() });
            }
          });
        }

        // Build readings payload for quick-entry endpoint
        readingsPayload.push({
          nozzleId: item.entry.nozzleId,
          readingValue: parseFloat(item.entry.readingValue),
          readingDate: item.entry.date,
          isSample: item.entry.is_sample || false,
          notes: ''
        });
      });
      // Build combined quick-entry payload
      const totalCreditTxn = nonSampleReadings.length > 0 ? paymentAllocation.credits.reduce((sum, c) => sum + toNumber(c.amount), 0) : 0;
      const stationPrices = Array.isArray(fuelPrices) ? fuelPrices.map(p => ({ fuelType: p.fuel_type, price: p.price_per_litre })) : [];
      const quickEntryPayload: any = {
        stationId: selectedStation,
        transactionDate: readingDate,
        readings: readingsPayload,
        paymentBreakdown: nonSampleReadings.length > 0 ? {
          cash: toNumber(paymentAllocation.cash),
          online: toNumber(paymentAllocation.online),
          credit: totalCreditTxn
        } : {
          cash: 0,
          online: 0,
          credit: 0
        },
        creditAllocations: nonSampleReadings.length > 0 && totalCreditTxn > 0 ? paymentAllocation.credits.map(c => ({ creditorId: c.creditorId, amount: toNumber(c.amount) })) : [],
        stationPrices
      };

      const response = await apiClient.post('/transactions/quick-entry', quickEntryPayload);
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Success ✓',
        description: `${Object.keys(readings).length} reading(s) saved with transaction. Sale value: ₹${safeToFixed(saleSummary.totalSaleValue, 2)}`,
        variant: 'success'
      });
      // Clear the form
      setReadings({});
      setPaymentAllocation({ cash: '', online: '', credits: [] });
      // Invalidate and refetch pumps data
      queryClient.invalidateQueries({ queryKey: ['pumps', selectedStation] });
      queryClient.invalidateQueries({ queryKey: ['pumps-data', selectedStation] });
      queryClient.refetchQueries({ queryKey: ['pumps', selectedStation] });
      queryClient.refetchQueries({ queryKey: ['pumps-data', selectedStation] });
      // Invalidate dashboard data to refresh today's sales
      queryClient.invalidateQueries({ queryKey: ['dashboard', selectedStation] });
      // Invalidate sales report
      queryClient.invalidateQueries({ queryKey: ['daily-sales'] });
      // Invalidate stations to update todaySales
      queryClient.invalidateQueries({ queryKey: ['stations'] });
    },
    onError: (error: unknown) => {
      const title = 'Error';
      let description = 'Failed to save readings';
      // Try to extract backend response details
      const anyErr = error as any;
      const backendError = anyErr?.response?.data;
      if (backendError) {
        if (backendError.error) description = String(backendError.error);
        if (backendError.details) {
          try {
            description += `\nDetails: ${JSON.stringify(backendError.details)}`;
          } catch (_) {
            // Ignore JSON stringify errors
          }
        }
      } else if (error instanceof Error) {
        description = error.message;
      } else if (typeof error === 'object' && error && 'message' in (error as any)) {
        description = String((error as { message?: string }).message);
      }
      toast({ title, description, variant: 'destructive' });
    }
  });

  const handleReadingChange = (nozzleId: string, value: string) => {
    setReadings(prev => ({
      ...prev,
      [nozzleId]: {
        ...prev[nozzleId],
        nozzleId,
        readingValue: value,
        date: readingDate,
        paymentType: PaymentMethodEnum.CASH
      }
    }));
  };

  const handleSampleChange = (nozzleId: string, isSample: boolean) => {
    setReadings(prev => ({
      ...prev,
      [nozzleId]: {
        ...prev[nozzleId],
        is_sample: isSample
      }
    }));
  };

  const hasPriceForFuelType = (fuelType: string): boolean => {
    if (!Array.isArray(fuelPrices) || fuelPrices.length === 0) {
      return false;
    }
    return fuelPrices.some(p => (p.fuel_type || '').toUpperCase() === fuelType.toUpperCase());
  };

  // Get all fuel types that are in use but missing prices
  // (Already calculated in the hook, but kept for backward compatibility with getMissingFuelTypes calls)
  const getMissingFuelTypes = (): string[] => {
    return missingPricesFuelTypes;
  };

  const handleSubmit = () => {
    const entries = Object.values(readings).filter(r => r.readingValue && parseFloat(r.readingValue) > 0);
    if (entries.length === 0) {
      toast({
        title: 'No readings entered',
        description: 'Please enter at least one reading',
        variant: 'destructive'
      });
      return;
    }

    // Separate sample and non-sample readings
    const nonSampleEntries = entries.filter(e => !e.is_sample);

    // Only validate payment allocation if there are non-sample readings
    if (nonSampleEntries.length > 0) {
      const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + toNumber(c.amount), 0);
      const allocated = toNumber(paymentAllocation.cash) + toNumber(paymentAllocation.online) + totalCredit;

      // Check if payment is completely missing
      if (allocated === 0 && saleSummary.totalSaleValue > 0) {
        toast({
          title: 'Payment Required',
          description: `At least one payment method (cash, online, or credit) must be greater than 0 for sale value ₹${safeToFixed(saleSummary.totalSaleValue, 2)}`,
          variant: 'destructive'
        });
        return;
      }

      if (Math.abs(allocated - saleSummary.totalSaleValue) > 0.01) {
        toast({
          title: 'Payment Not Allocated',
          description: `Total payment (₹${safeToFixed(allocated, 2)}) must match sale value (₹${safeToFixed(saleSummary.totalSaleValue, 2)})`,
          variant: 'destructive'
        });
        return;
      }

      // Validate credit requires creditor
      if (totalCredit > 0 && paymentAllocation.credits.some(c => !c.creditorId)) {
        toast({
          title: 'Creditor Required',
          description: 'Please select a creditor for each credit allocation',
          variant: 'destructive'
        });
        return;
      }
    }

    // Validate fuel prices (only for non-sample readings)
    const nozzlesWithNonSampleReadings = pumps
      ?.flatMap(p => p.nozzles || [])
      .filter(n => nonSampleEntries.some(e => e.nozzleId === n.id)) || [];

    const missingPrices = nozzlesWithNonSampleReadings.filter(n => !hasPriceForFuelType(n.fuelType));
    if (missingPrices.length > 0) {
      const missingFuelTypes = [...new Set(missingPrices.map((n: any) => n.fuelType))].join(', ');
      toast({
        title: 'Missing Fuel Prices',
        description: `Please set prices for: ${missingFuelTypes}`,
        variant: 'destructive'
      });
      return;
    }

    submitReadingsMutation.mutate(entries);
  };

  const pendingCount = Object.keys(readings).length;
  const totalNozzles = pumps?.reduce((sum, pump) => sum + (pump.nozzles?.length || 0), 0) || 0;

  // Loading states
  if (pumpsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading station data...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Quick Data Entry</h1>
                  <p className="text-gray-600">Enhanced with real-time sale calculations</p>
                </div>
              </div>
              <RoleBadge
                role={isOwner ? 'owner' : isManager ? 'manager' : 'employee'}
                size="md"
              />
            </div>
          </CardHeader>
        </Card>

        {/* Station Selection - Only for owners and managers */}
        {canSelectStation && (
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Label htmlFor="station-select" className="text-sm font-medium text-gray-700">
                  Select Station:
                </Label>
                <Select value={selectedStation} onValueChange={setSelectedStation}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Choose a station" />
                  </SelectTrigger>
                  <SelectContent>
                    {stations?.map((station) => (
                      <SelectItem key={station.id} value={station.id}>
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4" />
                          <span>{station.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Station Display - For employees */}
        {isEmployee && selectedStation && (
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Label className="text-sm font-medium text-gray-700">
                  Your Station:
                </Label>
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {stations?.find(s => s.id === selectedStation)?.name || 'Station'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No station selected */}
        {!selectedStation && (
          <Card className="shadow-lg">
            <CardContent className="p-8 text-center">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Select a Station</h2>
              <p className="text-gray-600">Please select a station to continue with data entry.</p>
            </CardContent>
          </Card>
        )}

        {/* Station selected - show data entry */}
        {selectedStation && (
          <>
            {/* Missing Fuel Prices Alert */}
            {missingPricesFuelTypes.length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">Fuel Prices Required</p>
                      <p className="text-sm text-amber-700">
                        Missing prices for: {missingPricesFuelTypes.join(', ')}.
                        Please set prices before entering readings.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reading Date */}
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <Label htmlFor="reading-date" className="text-sm font-medium text-gray-700">
                    Reading Date:
                  </Label>
                  <Input
                    id="reading-date"
                    type="date"
                    value={readingDate}
                    onChange={(e) => setReadingDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pumps and Nozzles */}
            <div className="grid gap-6">
              {pumps?.map((pump) => (
                <Card key={pump.id} className="shadow-lg">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-3">
                      <Fuel className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Pump {pump.name || pump.id}
                      </h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pump.nozzles?.map((nozzle: any) => {
                      const nozzleId = nozzle.id;
                      const reading = readings[nozzleId];
                      const lastReading = allLastReadings ? allLastReadings[nozzleId] : undefined;
                      const compareValue = (lastReading !== null && lastReading !== undefined)
                        ? lastReading
                        : (nozzle.initialReading || 0);
                      const { litres, saleValue } = calculateNozzleSale(nozzle, reading?.readingValue, compareValue, fuelPrices);

                      return (
                        <div key={nozzleId} className="border rounded-lg p-2 sm:p-4 bg-white hover:bg-brand-50 transition-colors border-brand-200">
                          {/* Header */}
                          <div className="flex flex-col gap-2 mb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge variant="outline" className="text-xs font-semibold px-1.5 py-0.5 sm:px-2 sm:py-1 border-brand-300 whitespace-nowrap">
                                  #{nozzle.nozzleNumber}
                                </Badge>
                                <Badge className={`${getFuelBadgeClasses(nozzle.fuelType)} text-xs font-semibold px-1.5 py-0.5 sm:px-2 sm:py-1 whitespace-nowrap`}>
                                  {nozzle.fuelType}
                                </Badge>
                                {!hasPriceForFuelType(nozzle.fuelType) && (
                                  <span className="text-red-600 text-xs font-bold bg-red-50 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded whitespace-nowrap">⚠ No price</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`sample-${nozzleId}`} className="text-xs text-brand-600 font-medium">
                                  Sample
                                </Label>
                                <Switch
                                  id={`sample-${nozzleId}`}
                                  checked={reading?.is_sample || false}
                                  onCheckedChange={(checked) => handleSampleChange(nozzleId, checked)}
                                />
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="text-xs text-brand-500 font-medium">Previous</div>
                              <div className="text-base sm:text-lg font-bold text-brand-900 break-words">{safeToFixed(compareValue, 1)} L</div>
                            </div>
                          </div>
                          {/* Input Section */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="relative">
                                <ReadingInput
                                  value={reading?.readingValue !== undefined && reading?.readingValue !== null ? reading.readingValue : ''}
                                  onChange={(val: string) => handleReadingChange(nozzleId, val)}
                                  disabled={nozzle.status !== EquipmentStatusEnum.ACTIVE || !hasPriceForFuelType(nozzle.fuelType)}
                                  placeholder="Current reading"
                                  className={`text-base sm:text-sm h-10 sm:h-9 font-semibold w-full break-words overflow-hidden ${!hasPriceForFuelType(nozzle.fuelType) ? 'border-red-300 bg-red-50 text-red-900' : 'border-brand-300 text-brand-900'}`}
                                />
                                {(() => {
                                  const enteredValue = reading?.readingValue !== undefined && reading?.readingValue !== '' ? parseFloat(reading.readingValue) : undefined;
                                  return reading?.readingValue && enteredValue !== undefined && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                      {enteredValue > compareValue ? (
                                        <Check className="w-5 h-5 text-emerald-600 font-bold" />
                                      ) : (
                                        <span className="text-xs text-red-700 font-bold">Invalid</span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                            {/* Sale Calculation */}
                            <div className="text-right">
                              {reading?.readingValue && parseFloat(reading.readingValue) > compareValue ? (
                                <div>
                                  <p className="text-sm text-gray-600">
                                    {safeToFixed(litres, 2)} L
                                  </p>
                                  <p className="font-semibold text-green-600">
                                    ₹{safeToFixed(saleValue, 2)}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No sale</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Sale Summary */}
            {saleSummary.totalSaleValue > 0 && (
              <Card className="shadow-lg">
                <CardHeader className="pb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Sale Summary</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">Total Litres</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {safeToFixed(saleSummary.totalLiters, 2)} L
                      </p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">Total Value</p>
                      <p className="text-2xl font-bold text-green-600">
                        ₹{safeToFixed(saleSummary.totalSaleValue, 2)}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg col-span-2">
                      <p className="text-sm text-gray-600">By Fuel Type</p>
                      <div className="flex flex-wrap justify-center gap-2 mt-2">
                        {Object.entries(saleSummary.byFuelType).map(([fuelType, data]) => (
                          <Badge key={fuelType} variant="secondary">
                            {fuelType}: {safeToFixed(data.liters, 1)}L (₹{safeToFixed(data.value, 0)})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Allocation */}
            {nonSampleReadings.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Payment Allocation</h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Status:</span>
                      <Badge variant={paymentMatchStatus.isMatched ? "default" : "destructive"} className="px-2 py-1">
                        {paymentMatchStatus.isMatched ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Matched
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Mismatch
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                  {!paymentMatchStatus.isMatched && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded-md">
                      Allocated: ₹{safeToFixed(paymentMatchStatus.allocated, 2)} | 
                      Required: ₹{safeToFixed(paymentMatchStatus.required, 2)} | 
                      Difference: ₹{safeToFixed(Math.abs(paymentMatchStatus.difference), 2)} 
                      {paymentMatchStatus.difference > 0 ? 'excess' : 'short'}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Cash Payment */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Cash Payment</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={paymentAllocation.cash}
                        onChange={(e) => setPaymentAllocation(prev => ({ ...prev, cash: e.target.value }))}
                        placeholder="0.00"
                        className="w-full"
                      />
                    </div>

                    {/* Online Payment */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Online Payment</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={paymentAllocation.online}
                        onChange={(e) => setPaymentAllocation(prev => ({ ...prev, online: e.target.value }))}
                        placeholder="0.00"
                        className="w-full"
                      />
                    </div>

                    {/* Credit Payment */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Credit Payment</Label>
                      <div className="text-sm text-gray-600">
                        Total: ₹{safeToFixed(paymentAllocation.credits.reduce((sum, c) => sum + toNumber(c.amount), 0), 2)}
                      </div>
                    </div>
                  </div>

                  {/* Credit Allocations */}
                  {paymentAllocation.credits.map((credit, index) => {
                    const selectedCreditor = creditors?.find(c => c.id === credit.creditorId);
                    const availableBalance = selectedCreditor ? selectedCreditor.creditLimit - selectedCreditor.currentBalance : 0;
                    
                    return (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-2 p-4 border rounded-lg">
                        <div className="col-span-1">
                          <Select
                            value={credit.creditorId}
                            onValueChange={(value) => {
                              const newCredits = [...paymentAllocation.credits];
                              newCredits[index].creditorId = value;
                              setPaymentAllocation(prev => ({ ...prev, credits: newCredits }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select creditor" />
                            </SelectTrigger>
                            <SelectContent>
                              {creditors?.map((creditor) => (
                                <SelectItem key={creditor.id} value={creditor.id}>
                                  {creditor.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedCreditor && (
                            <p className="text-xs text-gray-600 mt-1">
                              Available: ₹{safeToFixed(availableBalance, 2)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={credit.amount}
                            onChange={(e) => {
                              const newCredits = [...paymentAllocation.credits];
                              newCredits[index].amount = e.target.value;
                              setPaymentAllocation(prev => ({ ...prev, credits: newCredits }));
                            }}
                            placeholder="0.00"
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              const newCredits = paymentAllocation.credits.filter((_, i) => i !== index);
                              setPaymentAllocation(prev => ({ ...prev, credits: newCredits }));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Credit Button */}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPaymentAllocation(prev => ({
                        ...prev,
                        credits: [...prev.credits, { creditorId: '', amount: '' }]
                      }));
                    }}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Credit Payment
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {pendingCount} of {totalNozzles} nozzles entered
                  </div>
                  <Button
                    onClick={() => {
                      handleSubmit();
                    }}
                    disabled={Object.keys(readings).length === 0}
                    className="px-8"
                    size="lg"
                  >
                    {submitReadingsMutation.isPending ? 'Saving...' : 'Submit All Readings ✓'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
