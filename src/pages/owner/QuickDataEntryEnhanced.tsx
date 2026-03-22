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

import { useState, useMemo, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
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
import { RoleBadge } from '@/components/ui/RoleBadge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { useStations, usePumps } from '@/hooks/api';
import { useFuelPricesForStation } from '@/hooks/useFuelPricesForStation';
import { useFuelPricesGlobal } from '@/context/FuelPricesContext';
import { useQuickEntry } from '@/hooks/useQuickEntry';
import { safeToFixed } from '@/lib/format-utils';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import {
  Zap,
  Building2,
  Fuel,
  AlertTriangle
} from 'lucide-react';
import { PaymentAllocationForm } from '@/components/features/payment/PaymentAllocationForm';
import { NozzleReadingRow } from '@/components/owner/NozzleReadingRow';

import type {
  Station,
  Pump
} from '@/types/api';
import type { StationStaff } from '@/types/station';
import type {
  ReadingEntry,
  CreditAllocation,
  PaymentAllocation,
  PaymentSubBreakdown,
  Creditor
} from '@/types/finance';

// Utility function to calculate litres and sale value for a nozzle
const calculateNozzleSale = (nozzle: any, readingValue: string, lastReading: number | null, fuelPrices: any[]) => {
  const enteredValue = toNumber(readingValue || '0');
  if (!enteredValue || isNaN(enteredValue) || enteredValue === 0) {
    return { litres: 0, saleValue: 0 };
  }
  
  const nozzleLast = nozzle?.lastReading !== undefined && nozzle?.lastReading !== null ? toNumber(String(nozzle.lastReading)) : undefined;
  const initial = nozzle?.initialReading !== undefined && nozzle?.initialReading !== null ? toNumber(String(nozzle.initialReading)) : 0;
  let last: number | undefined = undefined;
  if (lastReading !== null && lastReading !== undefined) {
    last = Number(lastReading);
  } else if (nozzleLast !== undefined) {
    last = nozzleLast;
  } else if (initial !== undefined && !isNaN(initial)) {
    last = initial;
  }
  if (last === undefined || isNaN(last)) {
    return { litres: 0, saleValue: 0 };
  }
  const litres = Math.max(0, enteredValue - last);
  if (litres === 0) {
    return { litres: 0, saleValue: 0 };
  }
  
  // Safety check: ensure fuelPrices is an array before calling .find()
  const pricesArray = Array.isArray(fuelPrices) ? fuelPrices : [];
  if (pricesArray.length === 0) {
    return { litres, saleValue: 0 };
  }
  
  // Find price - check both snake_case and camelCase keys for compatibility
  const fuelTypeToFind = (nozzle?.fuelType || '').toUpperCase();
  let priceData = pricesArray.find(p => 
    (p.fuel_type || '').toUpperCase() === fuelTypeToFind
  );
  
  const price = toNumber(String(priceData?.price_per_litre || 0));
  const saleValue = litres * price;
  return { litres, saleValue };
}

export default function QuickDataEntryEnhanced() {
  const { user } = useAuth();
  const { stations: userStations } = useRoleAccess();
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [paymentAllocation, setPaymentAllocation] = useState<PaymentAllocation>({
    cash: '0',
    online: '0',
    onlineBreakdown: null,
    credits: []
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ================================================================================
  // HOOK: useQuickEntry - Delegates employees, creditors, mutations to hook
  // ================================================================================
  const quickEntry = useQuickEntry({
    stationId: selectedStation,
    mode: 'owner',
    onSuccess: () => {
      // Clear the form
      setPaymentAllocation({ cash: '', online: '', onlineBreakdown: null, credits: [] });
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
    }
  });

  // Use hook state & actions for readings, dates, mutations, employees, creditors
  const {
    readings,
    readingDate,
    updateReading: hookUpdateReading,
    setReadingDate: hookSetReadingDate,
    employees: hookEmployees,
    creditors: hookCreditors,
    submitReadingsMutation,
    updatePaymentBreakdown,
    updateCreditAllocations
  } = quickEntry;

  // Get fuel prices context
  const { setStationId } = useFuelPricesGlobal();

  // Fetch stations
  const stationsQuery = useStations();
  const stationsResponse = stationsQuery.data;

  // type guard for API success shape
  const isApiSuccess = <T,>(v: any): v is { success: true; data: T } => Boolean(v && typeof v === 'object' && v.success === true && 'data' in v);

  const stations: Station[] = useMemo(() => {
    if (!stationsResponse) return [];
    if (isApiSuccess<Station[]>(stationsResponse) && Array.isArray(stationsResponse.data)) return stationsResponse.data;
    return [];
  }, [stationsResponse]);

  // Determine if user can select stations (owners/managers) or is auto-assigned (employees)
  const canSelectStation = user?.role === 'owner' || user?.role === 'manager';
  const isEmployee = user?.role === 'employee';
  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager';
  
  // Map hook employees to component state
  const employees: StationStaff[] = useMemo(() => {
    return (hookEmployees || []) as StationStaff[];
  }, [hookEmployees]);
  const employeesToAssign = employees.filter((emp: StationStaff) => emp.role === 'employee');

  // Map hook creditors to component state
  const creditors: Creditor[] = useMemo(() => {
    return hookCreditors || [];
  }, [hookCreditors]);

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

  // Auto-select first employee when employees list is populated (for owners/managers)
  useEffect(() => {
    if (isOwner || isManager) {
      if (employeesToAssign.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(employeesToAssign[0].id);
      }
    }
  }, [employeesToAssign, selectedEmployeeId, isOwner, isManager]);

  // Update context when selected station changes (loads prices for that station)
  useEffect(() => {
    if (selectedStation) {
      setStationId(selectedStation);
    }
  }, [selectedStation, setStationId]);

  // Sync hook readingDate with local state when station changes
  useEffect(() => {
    hookSetReadingDate(readingDate);
  }, [readingDate, hookSetReadingDate]);

  // Fetch pumps for selected station
  const pumpsQuery = usePumps(selectedStation);
  const pumpsResponse = pumpsQuery.data;
  const pumps: Pump[] = useMemo(() => {
    if (!pumpsResponse) return [];
    if (isApiSuccess<Pump[]>(pumpsResponse) && Array.isArray(pumpsResponse.data)) return pumpsResponse.data;
    return [];
  }, [pumpsResponse]);
  const pumpsLoading = pumpsQuery.isLoading;

  // Get fuel prices for selected station from global context (preloaded on app init)
  const { missingFuelTypes: missingPricesFuelTypes = [], pricesArray = [] } = useFuelPricesForStation(selectedStation);
  // Convert to array format for compatibility with existing code
  const fuelPrices = useMemo(() => Array.isArray(pricesArray) ? pricesArray : [], [pricesArray]);

  // Fetch true last readings for all nozzles to use in payment allocation calculation
  // Include nozzle IDs in query key so it refetches when nozzles/pumps change
  const nozzleIds = useMemo(() => {
    return pumps?.flatMap((p: any) => p.nozzles || []).map((n: any) => n.id) || [];
  }, [pumps]);

  // Create a stable string key for nozzle IDs to avoid array reference issues in queryKey
  const nozzleIdsKey = useMemo(() => {
    return nozzleIds.sort().join(',');
  }, [nozzleIds]);

  const { data: allLastReadings, isLoading: allLastReadingsLoading } = useQuery({
    queryKey: ['allNozzleLastReadings', selectedStation, nozzleIdsKey],
    queryFn: async () => {
      if (!selectedStation || !pumps || nozzleIds.length === 0) return {};
      try {
        const idsParam = nozzleIds.join(',');
        const res: any = await apiClient.get(`/readings/latest?ids=${encodeURIComponent(idsParam)}`);
        // Backend returns: { success: true, data: { [nozzleId]: readingValue } }
        return res?.data || {};
      } catch (err) {
        return {};
      }
    },
    enabled: !!selectedStation && !!pumps && nozzleIds.length > 0
  });

  // Helper: Calculate online breakdown total
  const calculateOnlineBreakdownTotal = (breakdown: PaymentSubBreakdown | null | undefined): number => {
    if (!breakdown) return 0;
    return (
      Object.values(breakdown.upi || {}).reduce((sum: number, v: any) => sum + (v || 0), 0) +
      Object.values(breakdown.card || {}).reduce((sum: number, v: any) => sum + (v || 0), 0) +
      Object.values(breakdown.oil_company || {}).reduce((sum: number, v: any) => sum + (v || 0), 0)
    );
  };

  // Calculate online breakdown total and validate
  const onlineBreakdownTotal = calculateOnlineBreakdownTotal(paymentAllocation.onlineBreakdown);
  const onlineBreakdownMismatch = paymentAllocation.onlineBreakdown ? 
    Math.abs(onlineBreakdownTotal - toNumber(paymentAllocation.online)) > 0.01 : false;

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
        pumpsArray.flatMap((pump: any) => (pump.nozzles ? pump.nozzles.map((nz: any) => nz.id) : []))
      );
      // Only process readings for valid, unique nozzle IDs
      const readingsToProcess = ((readings as Record<string, ReadingEntry>) || {});
      Object.entries(readingsToProcess).forEach(([nozzleId, reading]: [string, ReadingEntry]) => {
        if (!validNozzleIds.has(nozzleId)) return;
        if (!reading || !reading.readingValue) return;
        // Skip sample readings - they don't contribute to sale value
        if (reading.is_sample) return;
        // Find the nozzle object
        const nozzle = pumpsArray.flatMap((p: any) => p.nozzles || []).find((nz: any) => nz.id === nozzleId);
        if (!nozzle) return;
        // Match UI logic for last reading (compareValue)
        const initialReading = nozzle.initialReading ? parseFloat(String(nozzle.initialReading)) : null;
        // Use lastReading from nozzle object first, then from allLastReadings query
        const trueLastReading = nozzle.lastReading !== null && nozzle.lastReading !== undefined
          ? nozzle.lastReading
          : (allLastReadings ? allLastReadings[nozzle.id] : undefined);
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

  // Calculate non-sample readings count for UI logic
  const nonSampleReadings = useMemo(() => {
    return Object.values(readings).filter(r => r.readingValue && parseFloat(r.readingValue) > 0 && !r.is_sample);
  }, [readings]);

  // Initial payment allocation setup (only when completely empty)
  useEffect(() => {
    const totalSaleValue = saleSummary.totalSaleValue;
    const currentTotal =
      toNumber(paymentAllocation.cash) +
      toNumber(paymentAllocation.online) +
      paymentAllocation.credits.reduce((s: number, c: CreditAllocation) => s + toNumber(c.amount), 0);

    // Only set initial allocation if everything is empty and we have sales
    if (totalSaleValue > 0 && currentTotal === 0 && paymentAllocation.cash === '0' && paymentAllocation.online === '0' && paymentAllocation.credits.length === 0) {
      setPaymentAllocation({ cash: totalSaleValue.toString(), online: '0', onlineBreakdown: null, credits: [] });
    }
  }, [saleSummary.totalSaleValue, paymentAllocation]);

  // Auto-correct payment allocation: recalculate cash when sale value changes
  // This ensures payment allocation always reflects all entered readings
  useEffect(() => {
    const newTotalSaleValue = saleSummary.totalSaleValue;
    if (newTotalSaleValue <= 0) return;

    const currentCash = toNumber(paymentAllocation.cash);
    const currentOnline = toNumber(paymentAllocation.online);
    const totalCredit = paymentAllocation.credits.reduce((sum: number, c: CreditAllocation) => sum + toNumber(c.amount), 0);
    const totalAllocated = currentCash + currentOnline + totalCredit;

    // If total allocated doesn't match sale value, update cash to fill the gap
    // This handles cases where readings are adjusted and need the payment to be recalculated
    if (Math.abs(totalAllocated - newTotalSaleValue) > 0.01) {
      const newCash = Math.max(0, newTotalSaleValue - currentOnline - totalCredit);
      setPaymentAllocation(prev => ({
        ...prev,
        cash: newCash.toString()
      }));
    }
  }, [saleSummary.totalSaleValue, paymentAllocation]);

  // Sync payment allocation to hook's internal state whenever it changes
  useEffect(() => {
    updatePaymentBreakdown({
      cash: toNumber(paymentAllocation.cash),
      online: toNumber(paymentAllocation.online),
      credit: paymentAllocation.credits.reduce((sum: number, c: CreditAllocation) => sum + toNumber(c.amount), 0)
    });
    updateCreditAllocations(paymentAllocation.credits || []);
  }, [paymentAllocation, updatePaymentBreakdown, updateCreditAllocations]);

  // NOTE: Mutation is provided by useQuickEntry hook (submitReadingsMutation)
  // The hook handles all the complex logic for payment allocation, transaction creation, etc.

  const handleReadingChange = (nozzleId: string, value: string) => {
    // Use hook's updateReading method - params: (nozzleId, field, value)
    hookUpdateReading(nozzleId, 'readingValue', value);
  };

  const handleSampleChange = (nozzleId: string, isSample: boolean) => {
    // Use hook's updateReading method with is_sample flag
    hookUpdateReading(nozzleId, 'is_sample', isSample ? '1' : '0');
  };

  const hasPriceForFuelType = (fuelType: string): boolean => {
    if (!Array.isArray(fuelPrices) || fuelPrices.length === 0) {
      return false;
    }
    const fuelTypeUpper = (fuelType || '').toUpperCase();
    return fuelPrices.some(p => (p.fuel_type || '').toUpperCase() === fuelTypeUpper);
  };

  const handleSubmit = () => {
    const readingsArray = Array.isArray(readings) ? readings : Object.values(readings);
    const entries = readingsArray.filter((r: any) => r && (r.readingValue || r.closingReading) && parseFloat(r.readingValue || r.closingReading || '0') > 0);
    if (entries.length === 0) {
      toast({
        title: 'No readings entered',
        description: 'Please enter at least one reading',
        variant: 'destructive'
      });
      return;
    }

    // Separate sample and non-sample readings
    const nonSampleEntries = entries.filter((e: any) => !e.is_sample);

    // Validate online breakdown reconciliation
    const breakdownTotal = calculateOnlineBreakdownTotal(paymentAllocation.onlineBreakdown);
    const onlinePayment = toNumber(paymentAllocation.online);
    
    // If there's a breakdown but payment doesn't match, flag it
    if (breakdownTotal > 0 && Math.abs(breakdownTotal - onlinePayment) > 0.01) {
      toast({
        title: 'Online Payment Mismatch',
        description: `Breakdown total ₹${safeToFixed(breakdownTotal, 2)} does not match Online payment ₹${safeToFixed(onlinePayment, 2)}. Please verify your breakdown entries.`,
        variant: 'destructive'
      });
      return;
    }

    // Only validate payment allocation if there are non-sample readings
    if (nonSampleEntries.length > 0) {
      const totalCredit = paymentAllocation.credits.reduce((sum: number, c: CreditAllocation) => sum + toNumber(c.amount), 0);
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
      ?.flatMap((p: any) => p.nozzles || [])
      .filter((n: any) => nonSampleEntries.some(e => e.nozzleId === n.id)) || [];

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

    // Validate employee assignment
    if (!selectedEmployeeId) {
      toast({
        title: 'Employee Required',
        description: 'Please select an employee to assign these readings to',
        variant: 'destructive'
      });
      return;
    }

    // Sync final payment allocation to hook before submission
    updatePaymentBreakdown({
      cash: toNumber(paymentAllocation.cash),
      online: toNumber(paymentAllocation.online),
      credit: paymentAllocation.credits.reduce((sum: number, c: CreditAllocation) => sum + toNumber(c.amount), 0)
    });
    updateCreditAllocations(paymentAllocation.credits || []);
    
    // Call the hook's mutation with context needed for payment processing
    submitReadingsMutation.mutate({
      readings: entries,
      pumps,
      fuelPrices
    } as any);
  };

  const pendingCount = Object.keys(readings).length;
  const totalNozzles = pumps?.reduce((sum: number, pump: any) => sum + (pump.nozzles?.length || 0), 0) || 0;

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Station Selector */}
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="station-select" className="text-sm font-medium text-gray-700">
                    Station
                  </Label>
                  <Select value={selectedStation} onValueChange={setSelectedStation}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a station" />
                    </SelectTrigger>
                    <SelectContent>
                      {stations?.map((station: any) => (
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

                {/* Employee Assignment - Only for owners and managers */}
                {selectedStation && (
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="employee-select" className="text-sm font-medium text-gray-700">
                      Assign Entry To
                    </Label>
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employeesToAssign.map((employee: StationStaff) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            <span>{employee.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Reading Date */}
                {selectedStation && (
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="reading-date" className="text-sm font-medium text-gray-700">
                      Reading Date
                    </Label>
                    <Input
                      id="reading-date"
                      type="date"
                      value={readingDate}
                      onChange={(e) => hookSetReadingDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Station Display - For employees */}
        {isEmployee && selectedStation && (
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Station Display */}
                <div className="flex flex-col space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Your Station
                  </Label>
                  <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded text-sm font-medium text-blue-900">
                    <Building2 className="h-4 w-4" />
                    <span>
                      {stations?.find((s: any) => s.id === selectedStation)?.name || 'Station'}
                    </span>
                  </div>
                </div>

                {/* Reading Date */}
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="reading-date" className="text-sm font-medium text-gray-700">
                    Reading Date
                  </Label>
                  <Input
                    id="reading-date"
                    type="date"
                    value={readingDate}
                    onChange={(e) => hookSetReadingDate(e.target.value)}
                    className="w-full"
                  />
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

            {/* Pumps and Nozzles */}
            <div className="grid gap-6">
              {pumps?.map((pump: any) => (
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
                      // Calculate litres and sale value for this nozzle
                      const readingsRecord = (readings as Record<string, ReadingEntry>);
                      const reading = readingsRecord[nozzle.id];
                      const { litres, saleValue } = calculateNozzleSale(
                        nozzle,
                        reading?.readingValue || '',
                        nozzle.lastReading !== null && nozzle.lastReading !== undefined
                          ? nozzle.lastReading
                          : (allLastReadings ? allLastReadings[nozzle.id] : undefined),
                        fuelPrices
                      );

                      return (
                        <NozzleReadingRow
                          key={nozzle.id}
                          nozzle={nozzle}
                          readings={readingsRecord}
                          handleReadingChange={handleReadingChange}
                          handleSampleChange={handleSampleChange}
                          hasPriceForFuelType={hasPriceForFuelType}
                          lastReading={allLastReadings?.[nozzle.id]}
                          lastReadingLoading={allLastReadingsLoading}
                          showSaleCalculation={true}
                          litres={litres}
                          saleValue={saleValue}
                        />
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

            {/* Payment Allocation - Improved Component */}
            <PaymentAllocationForm
              paymentAllocation={paymentAllocation}
              setPaymentAllocation={setPaymentAllocation}
              totalRequired={saleSummary.totalSaleValue}
              creditors={creditors}
              nonSampleReadingsCount={nonSampleReadings.length}
            />

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
                    disabled={Object.keys(readings).length === 0 || onlineBreakdownMismatch || (canSelectStation && !selectedEmployeeId)}
                    className="px-8"
                    size="lg"
                    title={canSelectStation && !selectedEmployeeId ? 'Please select an employee to assign these readings to' : ''}
                  >
                    {submitReadingsMutation.isPending ? 'Saving...' : canSelectStation && !selectedEmployeeId ? 'Select employee first' : onlineBreakdownMismatch ? 'Fix breakdown mismatch' : 'Submit All Readings ✓'}
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
