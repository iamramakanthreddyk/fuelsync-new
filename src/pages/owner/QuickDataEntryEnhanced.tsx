// Child component for a single nozzle row, to allow hook usage per nozzle
interface NozzleReadingRowProps {
  nozzle: any;
  readings: Record<string, ReadingEntry>;
  handleReadingChange: (nozzleId: string, value: string) => void;
  hasPriceForFuelType: (fuelType: string) => boolean;
  getPrice: (fuelType: string) => number;
  lastReading?: number | null;
  lastReadingLoading?: boolean;
}
function NozzleReadingRow({
  nozzle,
  readings,
  handleReadingChange,
  hasPriceForFuelType,
  getPrice,
  lastReading,
  lastReadingLoading
}: NozzleReadingRowProps) {
  const initialReading = nozzle.initialReading ? parseFloat(String(nozzle.initialReading)) : null;
  // Always parse lastReading as float if present
  const parsedLastReading = (lastReading !== null && lastReading !== undefined) ? parseFloat(String(lastReading)) : null;
  const compareValue = (parsedLastReading !== null && !isNaN(parsedLastReading))
    ? parsedLastReading
    : (initialReading !== null && !isNaN(initialReading) ? initialReading : 0);

  const reading = readings[nozzle.id];
  const enteredValue = reading?.readingValue !== undefined && reading?.readingValue !== '' ? parseFloat(reading.readingValue) : undefined;
  const price = getPrice(nozzle.fuelType);
  const hasFuelPrice = hasPriceForFuelType(nozzle.fuelType);

  return (
    <div className="border rounded-lg p-4 bg-white hover:bg-gray-50/50 transition-colors">
      {/* Header - Clean and organized */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-medium px-2 py-1">
              #{nozzle.nozzleNumber}
            </Badge>
            <Badge className={`${getFuelBadgeClasses(nozzle.fuelType)} text-xs font-medium px-2 py-1`}>
              {nozzle.fuelType}
            </Badge>
          </div>
          {!hasFuelPrice && (
            <span className="text-red-500 text-xs font-medium">⚠ No price</span>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Previous</div>
          <div className="text-sm font-medium">{safeToFixed(compareValue, 1)} L</div>
        </div>
      </div>

      {/* Input Section - Clean and focused */}
      <div className="space-y-2">
        <div className="relative">
          <Input
            type="number"
            step="any"
            placeholder="Current reading"
            value={reading?.readingValue !== undefined && reading?.readingValue !== null ? reading.readingValue : ''}
            onChange={(e) => handleReadingChange(nozzle.id, e.target.value)}
            disabled={nozzle.status !== EquipmentStatusEnum.ACTIVE || !hasFuelPrice}
            className={`text-sm h-9 ${!hasFuelPrice ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
          />
          {/* Status indicators */}
          {reading?.readingValue && !lastReadingLoading && enteredValue !== undefined && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {enteredValue > compareValue ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <span className="text-xs text-red-600 font-medium">Invalid</span>
              )}
            </div>
          )}
        </div>

        {/* Sale calculation - Only show when valid */}
        {reading?.readingValue && enteredValue !== undefined && enteredValue > compareValue && hasFuelPrice && (
          <div className="mt-3 p-3 bg-green-50 rounded-md border border-green-200">
            <ReadingSaleCalculation
              nozzleNumber={nozzle.nozzleNumber}
              fuelType={nozzle.fuelType}
              lastReading={compareValue}
              enteredReading={enteredValue}
              fuelPrice={price}
              status={nozzle.status as EquipmentStatusEnum}
            />
          </div>
        )}

        {/* Error message - Only show when needed */}
        {!hasFuelPrice && (
          <div className="mt-2 p-2 bg-red-50 rounded-md border border-red-200">
            <p className="text-xs text-red-700 font-medium">
              Set fuel price in Prices page
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
/**
 * Quick Data Entry with Sale Calculations
 * Enhanced version with per-nozzle sale value calculations
 * 
 * READING ENTRY FLOW:
 * 1. Employee enters the CLOSING READING (current meter value on pump)
 * 2. System fetches the OPENING READING (previous meter reading)
 * 3. System calculates LITRES SOLD = closingReading - openingReading
 * 4. System fetches FUEL PRICE for the date
 * 5. System calculates SALE VALUE = litresSold × fuelPrice
 * 6. Employee allocates payment (cash/online/credit)
 * 7. Backend saves reading with all calculated values
 * 
 * IMPORTANT TERMINOLOGY:
 * - openingReading = lastReading (previous recorded meter value)
 * - closingReading = readingValue (meter value entered now)
 * - litresSold = calculated difference
 * - saleValue = totalAmount (calculated sale revenue)
 */

import { useState, useMemo, useEffect } from 'react';
// Batched last readings are fetched in-component; per-nozzle hook removed to avoid N requests
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { useStations, usePumps } from '@/hooks/api';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useFuelPricesForStation } from '@/hooks/useFuelPricesForStation';
import { useFuelPricesGlobal } from '@/context/FuelPricesContext';
import { safeToFixed } from '@/lib/format-utils';
import { getFuelBadgeClasses } from '@/lib/fuelColors';
import { PricesRequiredAlert } from '@/components/alerts/PricesRequiredAlert';
import { ReadingSaleCalculation } from '@/components/owner/ReadingSaleCalculation';
import { SaleValueSummary } from '@/components/owner/SaleValueSummary';
import { EquipmentStatusEnum, PaymentMethodEnum } from '@/core/enums';
import {
  Zap,
  Building2,
  Fuel,
  Check
} from 'lucide-react';

// Utility function to calculate litres and sale value for a nozzle
const calculateNozzleSale = (nozzle: any, readingValue: string, lastReading: number | null, fuelPrices: any[]) => {
  const enteredValue = parseFloat(readingValue || '0');
  const nozzleLast = nozzle?.lastReading !== undefined && nozzle?.lastReading !== null ? parseFloat(String(nozzle.lastReading)) : undefined;
  const initial = nozzle?.initialReading !== undefined && nozzle?.initialReading !== null ? parseFloat(String(nozzle.initialReading)) : 0;
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
  const priceData = fuelPrices?.find(p => (p.fuel_type || '').toUpperCase() === (nozzle?.fuelType || '').toUpperCase());
  const price = parseFloat(String(priceData?.price_per_litre || 0));
  const saleValue = litres * price;
  return { litres, saleValue };
};

interface ReadingEntry {
  nozzleId: string;
  readingValue: string;
  date: string;
  paymentType: string;
}

interface CreditAllocation {
  creditorId: string;
  amount: number;
}

interface PaymentAllocation {
  cash: number;
  online: number;
  credits: CreditAllocation[];
}

interface Creditor {
  id: string;
  name: string;
  businessName?: string;
  currentBalance: number;
  creditLimit: number;
}

export default function QuickDataEntry() {
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [readings, setReadings] = useState<Record<string, ReadingEntry>>({});
  const [readingDate, setReadingDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAllocation, setPaymentAllocation] = useState<PaymentAllocation>({
    cash: 0,
    online: 0,
    credits: []
  });

  // ...existing code...

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setStationId } = useFuelPricesGlobal();

  // Fetch stations
  const { data: stationsResponse } = useStations();
  const stations = stationsResponse?.data;

  // Auto-select first station on load
  useEffect(() => {
    if (stations && stations.length > 0 && !selectedStation) {
      setSelectedStation(stations[0].id);
    }
  }, [stations, selectedStation]);

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
  const { missingFuelTypes: missingPricesFuelTypes, pricesArray } = useFuelPricesForStation(selectedStation);
  // Convert to array format for compatibility with existing code
  const fuelPrices = pricesArray;

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
    if (pumps && Array.isArray(fuelPrices)) {
      
      // Build a set of valid nozzle IDs from the current pumps
      const validNozzleIds = new Set(
        pumps.flatMap(pump => (pump.nozzles ? pump.nozzles.map((nz: any) => nz.id) : []))
      );
      // Only process readings for valid, unique nozzle IDs
      Object.entries(readings).forEach(([nozzleId, reading]) => {
        if (!validNozzleIds.has(nozzleId)) return;
        if (!reading || !reading.readingValue) return;
        // Find the nozzle object
        const nozzle = pumps.flatMap(p => p.nozzles || []).find((nz: any) => nz.id === nozzleId);
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
        const { litres, saleValue } = calculateNozzleSale(nozzle, reading.readingValue, compareValue, fuelPrices);
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

  // Default payment allocation to total sale value (all cash) when no allocation exists
  useEffect(() => {
    const totalSaleValue = saleSummary.totalSaleValue;
    const currentTotal = paymentAllocation.cash + paymentAllocation.online + paymentAllocation.credits.reduce((s, c) => s + c.amount, 0);
    // Only set default if we have a sale value and no allocations yet
    if (totalSaleValue > 0 && currentTotal === 0) {
      setPaymentAllocation({ cash: totalSaleValue, online: 0, credits: [] });
    }
  }, [saleSummary.totalSaleValue]); // Only depend on sale value, not payment allocation to avoid loops

  // Fetch backend stats for today's sales (reactive to selectedStation)
  const { data: dashboardData } = useDashboardData(selectedStation);

  // Use backend value for today's sales

  // Smart proportional adjustment: when sale value changes, adjust all payment methods proportionally
  // This prevents the mismatch issue where only cash gets adjusted
  useEffect(() => {
    const newTotalSaleValue = saleSummary.totalSaleValue;
    const currentTotalAllocation = paymentAllocation.cash + paymentAllocation.online + paymentAllocation.credits.reduce((sum, c) => sum + c.amount, 0);

    // Only adjust if there's a meaningful change and we have allocations
    if (newTotalSaleValue > 0 && currentTotalAllocation > 0 && Math.abs(newTotalSaleValue - currentTotalAllocation) > 0.01) {
      const ratio = newTotalSaleValue / currentTotalAllocation;

      // Adjust all payment methods proportionally
      const newCash = Math.round((paymentAllocation.cash * ratio) * 100) / 100;
      const newOnline = Math.round((paymentAllocation.online * ratio) * 100) / 100;
      const newCredits = paymentAllocation.credits.map(credit => ({
        ...credit,
        amount: Math.round((credit.amount * ratio) * 100) / 100
      }));

      // Verify the new total matches (should be very close due to rounding)
      const newTotal = newCash + newOnline + newCredits.reduce((sum, c) => sum + c.amount, 0);
      const difference = newTotalSaleValue - newTotal;

      // Adjust cash to absorb any rounding difference
      const finalCash = Math.max(0, newCash + difference);

      setPaymentAllocation({
        cash: finalCash,
        online: newOnline,
        credits: newCredits
      });
    }
  }, [saleSummary.totalSaleValue]); // Only depend on sale value change

  // Submit readings mutation
  const submitReadingsMutation = useMutation({
    mutationFn: async (data: ReadingEntry[]) => {
      // Validate payment allocation matches sale value
      const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + c.amount, 0);
      const totalPayment = paymentAllocation.cash + paymentAllocation.online + totalCredit;
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

      // Build per-entry sale values so we can distribute payments proportionally
      const entriesWithSale = data.map(entry => {
        const nozzle = pumps?.flatMap(p => p.nozzles || []).find((n: any) => n.id === entry.nozzleId);
        const trueLastReading = allLastReadings ? allLastReadings[entry.nozzleId] : undefined;
        const lastReading = (trueLastReading !== undefined && trueLastReading !== null)
          ? trueLastReading
          : (nozzle?.initialReading || 0);
        const { saleValue } = calculateNozzleSale(nozzle, entry.readingValue, lastReading, fuelPrices);
        return { entry, saleValue };
      });

      const totalSale = entriesWithSale.reduce((s, e) => s + e.saleValue, 0);
      const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

      const cashRatio = totalSale > 0 ? (paymentAllocation.cash / totalSale) : 0;
      const onlineRatio = totalSale > 0 ? (paymentAllocation.online / totalSale) : 0;
      // For credit, distribute proportionally if multiple creditors
      // We'll use the first credit allocation for each reading for now (can be improved for per-reading split)

      let allocatedCash = 0, allocatedOnline = 0;
      const readingsPayload: Array<{ nozzleId: string; readingValue: number; readingDate: string; notes: string }> = [];

      entriesWithSale.forEach((item, idx) => {
        const isLast = idx === entriesWithSale.length - 1;
        let cashAmt = round2(item.saleValue * cashRatio);
        let onlineAmt = round2(item.saleValue * onlineRatio);
        const creditAmts: CreditAllocation[] = [];

        if (isLast) {
          cashAmt = round2(paymentAllocation.cash - allocatedCash);
          onlineAmt = round2(paymentAllocation.online - allocatedOnline);
        }

        allocatedCash = round2(allocatedCash + cashAmt);
        allocatedOnline = round2(allocatedOnline + onlineAmt);

        // Distribute credit among creditors proportionally for each reading
        let creditTotal = 0;
        if (totalCredit > 0) {
          paymentAllocation.credits.forEach((creditAlloc, cidx) => {
            let amt = round2(item.saleValue * (creditAlloc.amount / totalCredit));
            if (isLast && cidx === paymentAllocation.credits.length - 1) {
              amt = round2(creditAlloc.amount - creditTotal);
            }
            creditTotal += amt;
            if (amt > 0) {
              creditAmts.push({ creditorId: creditAlloc.creditorId, amount: amt });
            }
          });
        }

        // ...existing code...

        // Build readings payload for quick-entry endpoint
        readingsPayload.push({
          nozzleId: item.entry.nozzleId,
          readingValue: parseFloat(item.entry.readingValue),
          readingDate: item.entry.date,
          notes: ''
        });
      });
      // Build combined quick-entry payload
      const totalCreditTxn = paymentAllocation.credits.reduce((sum, c) => sum + c.amount, 0);
      const stationPrices = Array.isArray(fuelPrices) ? fuelPrices.map(p => ({ fuelType: p.fuel_type, price: p.price_per_litre })) : [];
      const quickEntryPayload: any = {
        stationId: selectedStation,
        transactionDate: readingDate,
        readings: readingsPayload,
        paymentBreakdown: {
          cash: paymentAllocation.cash,
          online: paymentAllocation.online,
          credit: totalCreditTxn
        },
        creditAllocations: totalCreditTxn > 0 ? paymentAllocation.credits.map(c => ({ creditorId: c.creditorId, amount: c.amount })) : [],
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
      setPaymentAllocation({ cash: 0, online: 0, credits: [] });
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
        nozzleId,
        readingValue: value,
        date: readingDate,
        paymentType: PaymentMethodEnum.CASH
      }
    }));
  };

  const hasPriceForFuelType = (fuelType: string): boolean => {
    if (!Array.isArray(fuelPrices) || fuelPrices.length === 0) {
      return false;
    }
    return fuelPrices.some(p => (p.fuel_type || '').toUpperCase() === fuelType.toUpperCase());
  };

  const getPrice = (fuelType: string): number => {
    if (!Array.isArray(fuelPrices)) return 0;
    const priceData = fuelPrices.find(p => (p.fuel_type || '').toUpperCase() === fuelType.toUpperCase());
    return priceData ? parseFloat(String(priceData.price_per_litre || 0)) : 0;
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

    // Validate payment allocation
    const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + c.amount, 0);
    const allocated = paymentAllocation.cash + paymentAllocation.online + totalCredit;
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

    // Validate fuel prices
    const nozzlesWithReadings = pumps
      ?.flatMap(p => p.nozzles || [])
      .filter(n => entries.some(e => e.nozzleId === n.id)) || [];

    const missingPrices = nozzlesWithReadings.filter(n => !hasPriceForFuelType(n.fuelType));
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

  return (
    <div className="container mx-auto p-2 sm:p-4 space-y-3 sm:space-y-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
            Quick Entry
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Fast nozzle reading entry with live calculations
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge className="text-sm px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600">
            {pendingCount} / {totalNozzles}
          </Badge>
        )}
      </div>

      {selectedStation && <PricesRequiredAlert stationId={selectedStation} showIfMissing={true} compact={true} hasPricesOverride={Boolean(fuelPrices && fuelPrices.length > 0)} />}

      {/* Station & Date Selection - Compact */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="station" className="text-xs sm:text-sm">Station</Label>
              <Select value={selectedStation} onValueChange={setSelectedStation}>
                <SelectTrigger id="station" className="mt-1.5">
                  <SelectValue placeholder="Choose a station" />
                </SelectTrigger>
                <SelectContent>
                  {stations?.map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {station.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="date" className="text-xs sm:text-sm">Date</Label>
              <Input
                id="date"
                type="date"
                value={readingDate}
                onChange={(e) => setReadingDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="mt-1.5"
              />
            </div>
            <div className="flex items-end">
              <div className="w-full text-xs text-muted-foreground bg-gray-50 p-2.5 rounded-md border">
                {selectedStation && pumps ? (
                  <span className="font-semibold text-gray-700">{totalNozzles} nozzles</span>
                ) : (
                  <span>Select station</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Readings Entry */}
      {selectedStation && pumpsLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-sm text-muted-foreground">
              {pumpsLoading ? 'Loading pumps...' : 'Loading fuel prices...'}
            </div>
          </CardContent>
        </Card>
      ) : selectedStation && pumps && pumps.length > 0 ? (
        <>
          {/* Show warning if missing fuel prices */}
          {getMissingFuelTypes().length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-900">
                ⚠ Missing prices for: <span className="text-amber-700 font-bold">{getMissingFuelTypes().join(', ')}</span>
              </p>
            </div>
          )}

          {/* Two Column Layout: Pumps + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Pump Nozzles (2 cols) */}
            <div className="lg:col-span-2 space-y-2">
              {pumps.map((pump) => (
                <Card key={pump.id} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Fuel className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-base">Pump {pump.pumpNumber}</h3>
                          <p className="text-sm text-muted-foreground">{pump.name}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs px-3 py-1">
                        {pump.nozzles?.length || 0} nozzles
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pump.nozzles && pump.nozzles.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {pump.nozzles.map((nozzle: any) => (
                          <NozzleReadingRow
                            key={nozzle.id}
                            nozzle={nozzle}
                            readings={readings}
                            handleReadingChange={handleReadingChange}
                            hasPriceForFuelType={hasPriceForFuelType}
                            getPrice={getPrice}
                            lastReading={allLastReadings ? allLastReadings[nozzle.id] : null}
                            lastReadingLoading={allLastReadingsIsLoading}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        No nozzles configured
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Right: Payment Summary (1 col) */}

            <div className="lg:col-span-1 space-y-3">
              {/* Show backend stats for today's sales */}
              {pendingCount === 0 && dashboardData?.todaySales && dashboardData.todaySales > 0 && (
                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardContent className="p-3 md:p-4 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Today's Sales</p>
                      <p className="text-xl md:text-2xl font-bold text-blue-600 break-all md:break-normal">
                        ₹{dashboardData.todaySales >= 100000
                          ? `${safeToFixed(dashboardData.todaySales / 100000, 1)}L`
                          : safeToFixed(dashboardData.todaySales, 2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Improved Sale Summary UI */}
              {pendingCount > 0 && saleSummary.totalSaleValue > 0 && (
                <>
                  <Card className="border-2 border-green-400 bg-green-50 shadow-md">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-green-800 font-semibold uppercase tracking-wide mb-1">Sale Summary</p>
                          <p className="text-2xl md:text-3xl font-extrabold text-green-700">
                            ₹{saleSummary.totalSaleValue >= 100000 
                              ? `${safeToFixed(saleSummary.totalSaleValue / 100000, 1)}L`
                              : safeToFixed(saleSummary.totalSaleValue, 2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Readings Entered</p>
                          <p className="text-lg font-bold">{pendingCount} <span className="text-xs text-gray-500">/ {totalNozzles}</span></p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(saleSummary.byFuelType).map(([fuel, val]) => (
                          <div key={fuel} className="flex items-center justify-between text-sm">
                            <span className="font-medium text-green-900">{fuel}</span>
                            <span className="text-green-700">{safeToFixed(val.liters, 2)} L</span>
                            <span className="text-green-700 font-semibold">₹{safeToFixed(val.value, 2)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Payment Summary */}
                  <SaleValueSummary
                    summary={saleSummary}
                    paymentAllocation={paymentAllocation}
                    onPaymentChange={setPaymentAllocation}
                    creditors={creditors}
                    isLoading={submitReadingsMutation.isPending}
                    multiCredit
                  />

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      submitReadingsMutation.isPending ||
                      pendingCount === 0 ||
                      Math.abs(
                        (paymentAllocation.cash + paymentAllocation.online + paymentAllocation.credits.reduce((sum, c) => sum + c.amount, 0)) -
                        saleSummary.totalSaleValue
                      ) > 0.01
                    }
                    size="lg"
                    className="w-full mt-2"
                  >
                    {submitReadingsMutation.isPending ? (
                      'Saving...'
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Submit All ({pendingCount})
                      </>
                    )}
                  </Button>
                </>
              )}

              {pendingCount > 0 && saleSummary.totalSaleValue === 0 && (
                <Card className="border-2 border-amber-200 bg-amber-50">
                  <CardContent className="p-3 md:p-4 text-center">
                    <Fuel className="w-8 h-8 mx-auto text-amber-600 mb-2" />
                    <p className="text-xs text-amber-700 font-semibold">Invalid readings</p>
                    <p className="text-xs text-amber-600 mt-1">Ensure readings are greater than last reading and prices are set</p>
                  </CardContent>
                </Card>
              )}

              {pendingCount === 0 && (
                <Card className="border-dashed">
                  <CardContent className="p-4 text-center">
                    <Fuel className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">Enter readings to see summary</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Building2 className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Select a Station</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a station from above to start entering readings
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
