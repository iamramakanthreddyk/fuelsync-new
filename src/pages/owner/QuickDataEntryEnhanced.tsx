// Child component for a single nozzle row, to allow hook usage per nozzle
interface NozzleReadingRowProps {
  nozzle: any;
  readings: Record<string, ReadingEntry>;
  handleReadingChange: (nozzleId: string, value: string) => void;
  handleSampleChange: (nozzleId: string, isSample: boolean) => void;
  hasPriceForFuelType: (fuelType: string) => boolean;
  getPrice: (fuelType: string) => number;
  lastReading?: number | null;
  lastReadingLoading?: boolean;
}
function NozzleReadingRow({
  nozzle,
  readings,
  handleReadingChange,
  handleSampleChange,
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
    <div className="border rounded-lg p-2 sm:p-4 bg-white hover:bg-slate-50 transition-colors border-slate-200">
      {/* Header - Clean and organized - Improved mobile layout */}
      <div className="flex flex-col gap-2 mb-3">
        {/* Row 1: Badges */}
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="outline" className="text-xs font-semibold px-1.5 py-0.5 sm:px-2 sm:py-1 border-slate-300 whitespace-nowrap">
            #{nozzle.nozzleNumber}
          </Badge>
          <Badge className={`${getFuelBadgeClasses(nozzle.fuelType)} text-xs font-semibold px-1.5 py-0.5 sm:px-2 sm:py-1 whitespace-nowrap`}>
            {nozzle.fuelType}
          </Badge>
          {!hasFuelPrice && (
            <span className="text-red-600 text-xs font-bold bg-red-50 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded whitespace-nowrap">⚠ No price</span>
          )}
        </div>
        {/* Row 2: Previous reading */}
        <div className="text-left">
          <div className="text-xs text-slate-500 font-medium">Previous</div>
          <div className="text-base sm:text-lg font-bold text-slate-900 break-words">{safeToFixed(compareValue, 1)} L</div>
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
            className={`text-base sm:text-sm h-10 sm:h-9 font-semibold w-full break-words overflow-hidden ${!hasFuelPrice ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-300 text-slate-900'}`}
          />
          {/* Status indicators */}
          {reading?.readingValue && !lastReadingLoading && enteredValue !== undefined && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {enteredValue > compareValue ? (
                <Check className="w-5 h-5 text-emerald-600 font-bold" />
              ) : (
                <span className="text-xs text-red-700 font-bold">Invalid</span>
              )}
            </div>
          )}
        </div>

        {/* Sale calculation - Only show when valid and NOT a sample reading */}
        {reading?.readingValue && enteredValue !== undefined && enteredValue > compareValue && hasFuelPrice && !reading.is_sample && (
          <div className="mt-3 p-3 bg-emerald-50 rounded-lg border-2 border-emerald-200">
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

        {/* Sample Reading Checkbox */}
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={reading?.is_sample || false}
              onChange={(e) => handleSampleChange(nozzle.id, e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer flex-shrink-0"
              disabled={nozzle.status !== EquipmentStatusEnum.ACTIVE || !hasFuelPrice}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-blue-900">Quality Check / Sample Reading</p>
              <p className="text-xs text-blue-700 mt-0.5">Mark this if fuel was tested and returned to tank</p>
            </div>
          </label>
        </div>

        {/* Error message - Only show when needed */}
        {!hasFuelPrice && (
          <div className="mt-2 p-2.5 bg-red-50 rounded-lg border-2 border-red-200">
            <p className="text-xs text-red-700 font-bold">
              ⚠️ Set fuel price in Prices page
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
  // Safety check: ensure fuelPrices is an array before calling .find()
  const pricesArray = Array.isArray(fuelPrices) ? fuelPrices : [];
  const priceData = pricesArray.find(p => (p.fuel_type || '').toUpperCase() === (nozzle?.fuelType || '').toUpperCase());
  const price = parseFloat(String(priceData?.price_per_litre || 0));
  const saleValue = litres * price;
  return { litres, saleValue };
};

interface ReadingEntry {
  nozzleId: string;
  readingValue: string;
  date: string;
  paymentType: string;
  is_sample?: boolean;
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
  }, [saleSummary.totalSaleValue, paymentAllocation.cash, paymentAllocation.credits, paymentAllocation.online]);

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
  }, [saleSummary.totalSaleValue, paymentAllocation.cash, paymentAllocation.credits, paymentAllocation.online]);

  // Submit readings mutation
  const submitReadingsMutation = useMutation({
    mutationFn: async (data: ReadingEntry[]) => {
      // Separate sample and non-sample readings
      const nonSampleReadings = data.filter(r => !r.is_sample);

      // Only validate payment if there are non-sample readings
      if (nonSampleReadings.length > 0) {
        const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + c.amount, 0);
        const totalPayment = paymentAllocation.cash + paymentAllocation.online + totalCredit;
        
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

      const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + c.amount, 0);
      const cashRatio = totalSale > 0 ? (paymentAllocation.cash / totalSale) : 0;
      const onlineRatio = totalSale > 0 ? (paymentAllocation.online / totalSale) : 0;
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
          isSample: item.entry.is_sample || false,
          notes: ''
        });
      });
      // Build combined quick-entry payload
      const totalCreditTxn = nonSampleReadings.length > 0 ? paymentAllocation.credits.reduce((sum, c) => sum + c.amount, 0) : 0;
      const stationPrices = Array.isArray(fuelPrices) ? fuelPrices.map(p => ({ fuelType: p.fuel_type, price: p.price_per_litre })) : [];
      const quickEntryPayload: any = {
        stationId: selectedStation,
        transactionDate: readingDate,
        readings: readingsPayload,
        paymentBreakdown: {
          cash: nonSampleReadings.length > 0 ? paymentAllocation.cash : 0,
          online: nonSampleReadings.length > 0 ? paymentAllocation.online : 0,
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

    // Separate sample and non-sample readings
    const nonSampleEntries = entries.filter(e => !e.is_sample);

    // Only validate payment allocation if there are non-sample readings
    if (nonSampleEntries.length > 0) {
      const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + c.amount, 0);
      const allocated = paymentAllocation.cash + paymentAllocation.online + totalCredit;
      
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

  return (
    <div className="container mx-auto p-2 sm:p-4 space-y-3 sm:space-y-4 max-w-full lg:max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-amber-500" />
            Quick Entry
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Fast nozzle reading entry with live calculations
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge className="text-xs sm:text-sm px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold w-fit">
            {pendingCount} / {totalNozzles}
          </Badge>
        )}
      </div>

      {selectedStation && <PricesRequiredAlert stationId={selectedStation} showIfMissing={true} compact={true} hasPricesOverride={Boolean(fuelPrices && fuelPrices.length > 0)} />}

      {/* Station & Date Selection - Compact */}
      <Card className="border-slate-200">
        <CardContent className="p-2 sm:p-4">
          <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3">
            <div>
              <Label htmlFor="station" className="text-xs sm:text-sm font-semibold text-slate-700">Station</Label>
              <Select value={selectedStation} onValueChange={setSelectedStation}>
                <SelectTrigger id="station" className="mt-1 sm:mt-1.5 text-base sm:text-sm h-10 sm:h-9">
                  <SelectValue placeholder="Choose a station" />
                </SelectTrigger>
                <SelectContent>
                  {stations?.map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        {station.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="date" className="text-xs sm:text-sm font-semibold text-slate-700">Date</Label>
              <Input
                id="date"
                type="date"
                value={readingDate}
                onChange={(e) => setReadingDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="mt-1 sm:mt-1.5 text-base sm:text-sm h-10 sm:h-9"
              />
            </div>
            <div className="flex items-end">
              <div className="w-full text-sm sm:text-sm text-slate-600 bg-slate-50 p-2 sm:p-2.5 rounded-md border border-slate-200 font-semibold">
                {selectedStation && pumps ? (
                  <span className="text-slate-700">{totalNozzles} nozzles</span>
                ) : (
                  <span className="text-slate-500">Select station</span>
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
      ) : selectedStation && Array.isArray(pumps) && pumps.length > 0 ? (
        <>
          {/* Show warning if missing fuel prices */}
          {getMissingFuelTypes().length > 0 && (
            <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-lg">
              <p className="text-xs font-bold text-amber-900">
                ⚠️ Missing prices for: <span className="text-amber-700">{getMissingFuelTypes().join(', ')}</span>
              </p>
            </div>
          )}

          {/* Two Column Layout: Pumps + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Left: Pump Nozzles (2 cols) */}
            <div className="lg:col-span-2 space-y-2 sm:space-y-3">
              {pumps.map((pump) => (
                <Card key={pump.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500 border-slate-200">
                  <CardHeader className="pb-3 px-3 sm:px-6 py-3">
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Fuel className="w-4 sm:w-5 h-4 sm:h-5 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm sm:text-base text-slate-900 break-words">Pump {pump.pumpNumber}</h3>
                          <p className="text-xs sm:text-sm text-slate-600 truncate">{pump.name}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs px-1.5 sm:px-3 py-0.5 sm:py-1 font-semibold border-slate-300 flex-shrink-0 whitespace-nowrap">
                        {pump.nozzles?.length || 0}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 px-3 sm:px-6 py-3">
                    {pump.nozzles && pump.nozzles.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {pump.nozzles.map((nozzle: any) => (
                          <NozzleReadingRow
                            key={nozzle.id}
                            nozzle={nozzle}
                            readings={readings}
                            handleReadingChange={handleReadingChange}
                            handleSampleChange={handleSampleChange}
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
            <div className="lg:col-span-1 space-y-3 lg:sticky lg:top-4">
              {/* Show backend stats for today's sales */}
              {pendingCount === 0 && dashboardData?.todaySales && dashboardData.todaySales > 0 && (
                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardContent className="p-3 sm:p-4 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Today's Sales</p>
                      <p className="text-lg sm:text-2xl font-bold text-blue-600 break-words">
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
                    <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                      <div className="flex flex-col gap-2 sm:gap-3">
                        <div>
                          <p className="text-xs text-green-800 font-semibold uppercase tracking-wide mb-1">Sale Summary</p>
                          <p className="text-lg sm:text-2xl font-extrabold text-green-700 break-words">
                            ₹{saleSummary.totalSaleValue >= 100000 
                              ? `${safeToFixed(saleSummary.totalSaleValue / 100000, 2)}L`
                              : safeToFixed(saleSummary.totalSaleValue, 2)}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-muted-foreground">Readings Entered</p>
                          <p className="text-base sm:text-lg font-bold">{pendingCount} <span className="text-xs text-gray-500">/ {totalNozzles}</span></p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-xs sm:text-sm">
                        {Object.entries(saleSummary.byFuelType).map(([fuel, val]) => (
                          <div key={fuel} className="flex items-center justify-between gap-2">
                            <span className="font-medium text-green-900 truncate flex-1">{fuel}</span>
                            <span className="text-green-700 whitespace-nowrap">{safeToFixed(val.liters, 2)} L</span>
                            <span className="text-green-700 font-semibold whitespace-nowrap">₹{safeToFixed(val.value, 2)}</span>
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
                    className="w-full mt-3 sm:mt-4 h-10 sm:h-11 text-base sm:text-sm"
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

              {/* Sample-Only Readings - No Payment Section */}
              {pendingCount > 0 && saleSummary.totalSaleValue === 0 && Object.values(readings).some(r => r.is_sample) && (
                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardContent className="p-3 sm:p-4 space-y-3">
                    <div className="flex flex-col gap-2">
                      <div>
                        <p className="text-xs text-blue-800 font-semibold uppercase tracking-wide mb-1">Quality Check Readings</p>
                        <p className="text-base sm:text-lg font-bold text-blue-700">{pendingCount} Sample(s)</p>
                        <p className="text-xs text-blue-600 mt-2">No financial transaction • Meter updated only</p>
                      </div>
                    </div>

                    {/* Submit Button for Samples Only */}
                    <Button
                      onClick={handleSubmit}
                      disabled={submitReadingsMutation.isPending || pendingCount === 0}
                      size="lg"
                      className="w-full mt-3 h-10 sm:h-11 text-base sm:text-sm bg-blue-600 hover:bg-blue-700"
                    >
                      {submitReadingsMutation.isPending ? (
                        'Saving...'
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Record Sample(s) ({pendingCount})
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
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
