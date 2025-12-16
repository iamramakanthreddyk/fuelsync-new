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
  const enteredValue = reading?.readingValue ? parseFloat(reading.readingValue) : 0;
  const price = getPrice(nozzle.fuelType);
  const hasFuelPrice = hasPriceForFuelType(nozzle.fuelType);

  return (
    <div key={nozzle.id} className="border rounded-lg p-2 bg-white">
      <div className="flex items-center justify-between mb-1">
        <div className="flex flex-col">
          <Label className="text-xs font-semibold">
            Nozzle {nozzle.nozzleNumber} - {nozzle.fuelType}
            {!hasFuelPrice && <span className="text-red-500 ml-1">*</span>}
            <span className="text-xs text-muted-foreground ml-2">Last: {safeToFixed(compareValue, 1)}L</span>
          </Label>
        </div>
      </div>
      <div className="relative">
        <Input
          type="number"
          step="any"
          placeholder="0.00"
          value={reading?.readingValue || ''}
          onChange={(e) => handleReadingChange(nozzle.id, e.target.value)}
          disabled={nozzle.status !== EquipmentStatusEnum.ACTIVE || !hasFuelPrice}
          className={`text-xs h-7 ${!hasFuelPrice ? 'border-red-300 bg-red-50' : ''}`}
        />
        {/* Batched last readings used; no per-row loading indicator */}
        {reading?.readingValue && !lastReadingLoading && enteredValue > compareValue && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500">
            <Check className="w-4 h-4" />
          </div>
        )}
        {reading?.readingValue && !lastReadingLoading && enteredValue <= compareValue && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-500 text-xs">
            Incorrect reading
          </div>
        )}
      </div>
      {!hasFuelPrice && (
        <p className="text-xs text-red-600 mt-1">
          Price not set for this fuel type.<br />
          Set prices in the <b>Prices</b> page. Prices update automatically.
        </p>
      )}
      {/* Show calculation below input if reading is valid */}
      {reading?.readingValue && enteredValue > compareValue && hasFuelPrice && (
        <div className="mt-2 pt-2 border-t border-gray-200">
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
    // Fallback: prevent calculation and warn
    console.warn(`No valid last reading for nozzle ${nozzle?.id} (${nozzle?.fuelType}). Calculation skipped.`);
    return { litres: 0, saleValue: 0 };
  }
  const litres = Math.max(0, enteredValue - last);
  const price = fuelPrices?.find(p => p.fuel_type.toUpperCase() === (nozzle?.fuelType || '').toUpperCase())?.price_per_litre || 0;
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
  const pumps = pumpsResponse?.data;

  // Get fuel prices for selected station from global context (preloaded on app init)
  const { missingFuelTypes: missingPricesFuelTypes, pricesArray } = useFuelPricesForStation(selectedStation);
  // Convert to array format for compatibility with existing code
  const fuelPrices = pricesArray;

  // Fetch true last readings for all nozzles to use in payment allocation calculation
  const { data: allLastReadings, isLoading: allLastReadingsIsLoading } = useQuery({
    queryKey: ['allNozzleLastReadings', selectedStation],
    queryFn: async () => {
      if (!selectedStation || !pumps) return {};
      const nozzleIds = pumps.flatMap(p => p.nozzles || []).map(n => n.id);
      if (nozzleIds.length === 0) return {};
      try {
        const idsParam = nozzleIds.join(',');
        const res: any = await apiClient.get(`/readings/latest?ids=${encodeURIComponent(idsParam)}`);
        // Backend returns an object map: { [nozzleId]: readingValue }
        return res || {};
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
        console.warn('Unexpected creditors response format:', response);
        return [];
      } catch (error) {
        console.error('Failed to fetch creditors:', error);
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
        pumps.flatMap(pump => (pump.nozzles ? pump.nozzles.map(nz => nz.id) : []))
      );
      // Only process readings for valid, unique nozzle IDs
      Object.entries(readings).forEach(([nozzleId, reading]) => {
        if (!validNozzleIds.has(nozzleId)) return;
        if (!reading || !reading.readingValue) return;
        // Find the nozzle object
        const nozzle = pumps.flatMap(p => p.nozzles || []).find(nz => nz.id === nozzleId);
        if (!nozzle) return;
        const trueLastReading = allLastReadings ? allLastReadings[nozzle.id] : undefined;
        let lastReading: number | null = null;
        if (trueLastReading !== undefined && trueLastReading !== null) {
          lastReading = trueLastReading;
        } else if (nozzle?.initialReading !== undefined && nozzle?.initialReading !== null) {
          lastReading = nozzle.initialReading;
        } else {
          lastReading = null;
        }
        const { litres, saleValue } = calculateNozzleSale(nozzle, reading.readingValue, lastReading, fuelPrices);
        if (lastReading === null || typeof lastReading !== "number" || isNaN(lastReading)) {
          // Show warning in UI (optional: add a warning state/flag)
          console.warn(`No valid last reading for nozzle ${nozzle?.id} (${nozzle?.fuelType}). Skipping calculation.`);
        }
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
    if (totalSaleValue > 0 && currentTotal === 0) {
      setPaymentAllocation({ cash: totalSaleValue, online: 0, credits: [] });
    }
  }, [saleSummary.totalSaleValue, paymentAllocation.cash, paymentAllocation.online, paymentAllocation.credits]);

  // Fetch backend stats for today's sales (reactive to selectedStation)
  const { data: dashboardData } = useDashboardData(selectedStation);

  // Use backend value for today's sales

  // Move default allocation to an effect to avoid side-effects inside useMemo
  useEffect(() => {
    if (saleSummary.totalSaleValue > 0) {
      // Always adjust cash to make up the difference: total - online - total credit - online
      const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + c.amount, 0);
      const allocated = paymentAllocation.online + totalCredit;
      const newCash = Math.max(0, saleSummary.totalSaleValue - allocated);
      if (newCash !== paymentAllocation.cash) {
        setPaymentAllocation(prev => ({
          ...prev,
          cash: newCash
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleSummary.totalSaleValue, paymentAllocation.online, paymentAllocation.credits]);

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
        const nozzle = pumps?.flatMap(p => p.nozzles || []).find(n => n.id === entry.nozzleId);
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
        let creditAmts: CreditAllocation[] = [];

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
      queryClient.refetchQueries({ queryKey: ['pumps', selectedStation] });
      // Invalidate sales report
      queryClient.invalidateQueries({ queryKey: ['daily-sales'] });
      // Invalidate stations to update todaySales
      queryClient.invalidateQueries({ queryKey: ['stations'] });
    },
    onError: (error: unknown) => {
      let title = 'Error';
      let description = 'Failed to save readings';
      // Try to extract backend response details
      const anyErr = error as any;
      const backendError = anyErr?.response?.data;
      if (backendError) {
        if (backendError.error) description = String(backendError.error);
        if (backendError.details) {
          try {
            description += `\nDetails: ${JSON.stringify(backendError.details)}`;
          } catch (_) {}
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
    return fuelPrices.some(p => p.fuel_type.toUpperCase() === fuelType.toUpperCase());
  };

  const getPrice = (fuelType: string): number => {
    if (!Array.isArray(fuelPrices)) return 0;
    const priceData = fuelPrices.find(p => p.fuel_type.toUpperCase() === fuelType.toUpperCase());
    return priceData ? parseFloat(String(priceData.price_per_litre)) : 0;
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
      const missingFuelTypes = [...new Set(missingPrices.map(n => n.fuelType))].join(', ');
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
                <Card key={pump.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Fuel className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">Pump {pump.pumpNumber}</h3>
                          <p className="text-xs text-muted-foreground">{pump.name}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">{pump.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pump.nozzles && pump.nozzles.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {pump.nozzles.map((nozzle) => (
                          <NozzleReadingRow
                            key={nozzle.id}
                            nozzle={nozzle}
                            readings={readings}
                            handleReadingChange={handleReadingChange}
                            hasPriceForFuelType={hasPriceForFuelType}
                            getPrice={getPrice}
                            lastReading={allLastReadings && allLastReadings.data ? allLastReadings.data[nozzle.id] : (allLastReadings ? allLastReadings[nozzle.id] : null)}
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
              {pendingCount === 0 && dashboardData?.todaySales > 0 && (
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

              {/* Show local calculation only for entry validation */}
              {pendingCount > 0 && saleSummary.totalSaleValue > 0 && (
                <>
                  {/* Quick Summary Card */}
                  <Card className="border-2 border-green-200 bg-green-50">
                    <CardContent className="p-3 md:p-4 space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Current Entry Sale Value</p>
                        <p className="text-xl md:text-2xl font-bold text-green-600 break-all md:break-normal">
                          ₹{saleSummary.totalSaleValue >= 100000 
                            ? `${safeToFixed(saleSummary.totalSaleValue / 100000, 1)}L`
                            : safeToFixed(saleSummary.totalSaleValue, 2)}
                        </p>
                      </div>
                      <div className="flex gap-2 md:gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground truncate">Readings</p>
                          <p className="text-base md:text-lg font-semibold truncate">{pendingCount}/{totalNozzles}</p>
                        </div>
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
                    className="w-full"
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
