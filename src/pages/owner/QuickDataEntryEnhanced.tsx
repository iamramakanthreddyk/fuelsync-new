/**
 * Quick Data Entry with Sale Calculations
 * Enhanced version with per-nozzle sale value calculations
 */

import { useState, useMemo, useEffect } from 'react';
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
import { useFuelPricesData } from '@/hooks/useFuelPricesData';
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

interface ReadingEntry {
  nozzleId: string;
  readingValue: string;
  date: string;
  paymentType: string;
}

interface PaymentAllocation {
  cash: number;
  online: number;
  credit: number;
  creditorId?: string;
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
    credit: 0
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch stations
  const { data: stationsResponse } = useStations();
  const stations = stationsResponse?.data;

  // Auto-select first station on load
  useEffect(() => {
    if (stations && stations.length > 0 && !selectedStation) {
      setSelectedStation(stations[0].id);
    }
  }, [stations, selectedStation]);

  // Fetch pumps for selected station
  const { data: pumpsResponse, isLoading: pumpsLoading } = usePumps(selectedStation);
  const pumps = pumpsResponse?.data;

  // Fetch fuel prices for selected station
  const { data: fuelPrices, isLoading: pricesLoading } = useFuelPricesData(selectedStation);

  // Debug: Log fuel prices when they load
  useEffect(() => {
    if (fuelPrices && fuelPrices.length > 0) {
      // Fuel prices loaded
    } else if (selectedStation && !pricesLoading) {
      // No fuel prices available
    }
  }, [fuelPrices, selectedStation, pricesLoading]);

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

  // Calculate sale value summary
  const saleSummary = useMemo(() => {
    let totalLiters = 0;
    let totalSaleValue = 0;
    const byFuelType: Record<string, { liters: number; value: number }> = {};

    if (pumps && Array.isArray(fuelPrices)) {
      pumps.forEach(pump => {
        if (pump.nozzles) {
          pump.nozzles.forEach(nozzle => {
            const reading = readings[nozzle.id];
            if (reading && reading.readingValue) {
              const enteredValue = parseFloat(reading.readingValue);
              const lastReading = nozzle.lastReading ? parseFloat(String(nozzle.lastReading)) : null;
              const initialReading = nozzle.initialReading ? parseFloat(String(nozzle.initialReading)) : null;
              const compareValue = lastReading !== null && !isNaN(lastReading) 
                ? lastReading 
                : (initialReading !== null && !isNaN(initialReading) ? initialReading : 0);

              if (enteredValue > compareValue) {
                const liters = enteredValue - compareValue;
                const priceData = fuelPrices.find(p => p.fuel_type.toUpperCase() === nozzle.fuelType.toUpperCase());
                const price = priceData ? parseFloat(String(priceData.price_per_litre)) : 0;
                const saleValue = liters * price;

                totalLiters += liters;
                totalSaleValue += saleValue;

                if (!byFuelType[nozzle.fuelType]) {
                  byFuelType[nozzle.fuelType] = { liters: 0, value: 0 };
                }
                byFuelType[nozzle.fuelType].liters += liters;
                byFuelType[nozzle.fuelType].value += saleValue;
              }
            }
          });
        }
      });
    }

    return {
      totalLiters,
      totalSaleValue,
      byFuelType
    };
  }, [readings, pumps, fuelPrices]);

  // Move default allocation to an effect to avoid side-effects inside useMemo
  useEffect(() => {
    if (saleSummary.totalSaleValue > 0) {
      // Always adjust cash to make up the difference: total - online - credit
      const allocated = paymentAllocation.online + paymentAllocation.credit;
      const newCash = Math.max(0, saleSummary.totalSaleValue - allocated);
      if (newCash !== paymentAllocation.cash) {
        setPaymentAllocation(prev => ({
          ...prev,
          cash: newCash
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleSummary.totalSaleValue, paymentAllocation.online, paymentAllocation.credit]);

  // Submit readings mutation
  const submitReadingsMutation = useMutation({
    mutationFn: async (data: ReadingEntry[]) => {
      // Validate payment allocation matches sale value
      const totalPayment = paymentAllocation.cash + paymentAllocation.online + paymentAllocation.credit;
      if (Math.abs(totalPayment - saleSummary.totalSaleValue) > 0.01) {
        throw new Error(
          `Total payment (₹${safeToFixed(totalPayment, 2)}) must match sale value (₹${safeToFixed(saleSummary.totalSaleValue, 2)})`
        );
      }

      // Build per-entry sale values so we can distribute payments proportionally
      const entriesWithSale = data.map(entry => {
        const nozzle = pumps?.flatMap(p => p.nozzles || []).find(n => n.id === entry.nozzleId);
        const enteredValue = parseFloat(entry.readingValue || '0');
        const lastReading = nozzle?.lastReading ? parseFloat(String(nozzle.lastReading)) : null;
        const initialReading = nozzle?.initialReading ? parseFloat(String(nozzle.initialReading)) : null;
        const compareValue = lastReading !== null && !isNaN(lastReading)
          ? lastReading
          : (initialReading !== null && !isNaN(initialReading) ? initialReading : 0);

        const litres = Math.max(0, enteredValue - (compareValue || 0));
        const priceData = fuelPrices?.find(p => p.fuel_type.toUpperCase() === (nozzle?.fuelType || '').toUpperCase());
        const price = priceData ? parseFloat(String(priceData.price_per_litre)) : 0;
        const saleValue = litres * price;
        return { entry, saleValue };
      });

      const totalSale = entriesWithSale.reduce((s, e) => s + e.saleValue, 0);
      const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

      const cashRatio = totalSale > 0 ? (paymentAllocation.cash / totalSale) : 0;
      const onlineRatio = totalSale > 0 ? (paymentAllocation.online / totalSale) : 0;
      const creditRatio = totalSale > 0 ? (paymentAllocation.credit / totalSale) : 0;

      const promises: Promise<any>[] = [];
      let allocatedCash = 0, allocatedOnline = 0, allocatedCredit = 0;

      entriesWithSale.forEach((item, idx) => {
        const isLast = idx === entriesWithSale.length - 1;
        let cashAmt = round2(item.saleValue * cashRatio);
        let onlineAmt = round2(item.saleValue * onlineRatio);
        let creditAmt = round2(item.saleValue * creditRatio);

        if (isLast) {
          cashAmt = round2(paymentAllocation.cash - allocatedCash);
          onlineAmt = round2(paymentAllocation.online - allocatedOnline);
          creditAmt = round2(paymentAllocation.credit - allocatedCredit);
        }

        allocatedCash = round2(allocatedCash + cashAmt);
        allocatedOnline = round2(allocatedOnline + onlineAmt);
        allocatedCredit = round2(allocatedCredit + creditAmt);

        // Recalculate price and litres for this entry
        const nozzle = pumps?.flatMap(p => p.nozzles || []).find(n => n.id === item.entry.nozzleId);
        const enteredValue = parseFloat(item.entry.readingValue || '0');
        const lastReading = nozzle?.lastReading ? parseFloat(String(nozzle.lastReading)) : null;
        const initialReading = nozzle?.initialReading ? parseFloat(String(nozzle.initialReading)) : null;
        const compareValue = lastReading !== null && !isNaN(lastReading)
          ? lastReading
          : (initialReading !== null && !isNaN(initialReading) ? initialReading : 0);

        const litres = Math.max(0, enteredValue - (compareValue || 0));
        const priceData = fuelPrices?.find(p => p.fuel_type.toUpperCase() === (nozzle?.fuelType || '').toUpperCase());
        const price = priceData ? parseFloat(String(priceData.price_per_litre)) : 0;

        const readingData: any = {
          stationId: selectedStation,
          nozzleId: item.entry.nozzleId,
          readingValue: parseFloat(item.entry.readingValue),
          readingDate: item.entry.date,
          pricePerLitre: price,
          totalAmount: item.saleValue,
          litresSold: litres,
          cashAmount: cashAmt,
          onlineAmount: onlineAmt,
          creditAmount: creditAmt,
          notes: `Reading entered with cash: ₹${safeToFixed(cashAmt, 2)}, online: ₹${safeToFixed(onlineAmt, 2)}, credit: ₹${safeToFixed(creditAmt, 2)}`
        };

        // Only include creditorId if there's credit amount and a valid creditor selected
        if (creditAmt > 0 && paymentAllocation.creditorId && paymentAllocation.creditorId.trim()) {
          readingData.creditorId = paymentAllocation.creditorId;
        }

        // Validate required fields
        if (!readingData.stationId) {
          throw new Error('Station ID is required');
        }
        if (!readingData.nozzleId) {
          throw new Error('Nozzle ID is required');
        }

        promises.push(apiClient.post('/readings', readingData));
      });

      // Save readings (backend will create credit transactions when creditorId present)
      const readingsResult = await Promise.all(promises);
      return readingsResult;
    },
    onSuccess: () => {
      toast({
        title: 'Success ✓',
        description: `${Object.keys(readings).length} reading(s) saved. Sale value: ₹${safeToFixed(saleSummary.totalSaleValue, 2)}`,
        variant: 'success'
      });
      // Clear the form
      setReadings({});
      setPaymentAllocation({ cash: 0, online: 0, credit: 0 });
      // Invalidate and refetch pumps data
      queryClient.invalidateQueries({ queryKey: ['pumps', selectedStation] });
      queryClient.refetchQueries({ queryKey: ['pumps', selectedStation] });
      // Invalidate sales report
      queryClient.invalidateQueries({ queryKey: ['daily-sales'] });
    },
    onError: (error: unknown) => {
      let message = 'Failed to save readings';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error && 'message' in error) {
        message = String((error as { message?: string }).message);
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
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
  const getMissingFuelTypes = (): string[] => {
    if (!pumps || pumps.length === 0) return [];
    const allFuelTypes = new Set<string>();
    pumps.forEach(pump => {
      pump.nozzles?.forEach(nozzle => {
        if (nozzle.status === EquipmentStatusEnum.ACTIVE) {
          allFuelTypes.add(nozzle.fuelType.toUpperCase());
        }
      });
    });
    
    const missing: string[] = [];
    allFuelTypes.forEach(fuelType => {
      if (!hasPriceForFuelType(fuelType)) {
        missing.push(fuelType);
      }
    });
    return missing;
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
    const allocated = paymentAllocation.cash + paymentAllocation.online + paymentAllocation.credit;
    if (Math.abs(allocated - saleSummary.totalSaleValue) > 0.01) {
      toast({
        title: 'Payment Not Allocated',
        description: `Total payment (₹${safeToFixed(allocated, 2)}) must match sale value (₹${safeToFixed(saleSummary.totalSaleValue, 2)})`,
        variant: 'destructive'
      });
      return;
    }

    // Validate credit requires creditor
    if (paymentAllocation.credit > 0 && !paymentAllocation.creditorId) {
      toast({
        title: 'Creditor Required',
        description: 'Please select a creditor to record credit sales',
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
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
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

      {selectedStation && <PricesRequiredAlert stationId={selectedStation} showIfMissing={true} compact={true} />}

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
      {selectedStation && (pumpsLoading || pricesLoading) ? (
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
            <div className="lg:col-span-2 space-y-3">
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
                  <CardContent className="space-y-3">
                    {pump.nozzles && pump.nozzles.length > 0 ? (
                      <div className="space-y-3">
                        {pump.nozzles.map((nozzle) => {
                          const lastReading = nozzle.lastReading ? parseFloat(String(nozzle.lastReading)) : null;
                          const initialReading = nozzle.initialReading ? parseFloat(String(nozzle.initialReading)) : null;
                          const compareValue = lastReading !== null && !isNaN(lastReading)
                            ? lastReading
                            : (initialReading !== null && !isNaN(initialReading) ? initialReading : 0);

                          const reading = readings[nozzle.id];
                          const enteredValue = reading?.readingValue ? parseFloat(reading.readingValue) : 0;
                          const price = getPrice(nozzle.fuelType);
                          const hasFuelPrice = hasPriceForFuelType(nozzle.fuelType);

                          // Always show input field
                          return (
                            <div key={nozzle.id} className="border rounded-lg p-2.5 bg-white">
                              <div className="flex items-center justify-between mb-1.5">
                                <Label className="text-xs font-semibold">
                                  Nozzle {nozzle.nozzleNumber} - {nozzle.fuelType}
                                  {!hasFuelPrice && <span className="text-red-500 ml-1">*</span>}
                                </Label>
                                <span className="text-xs text-muted-foreground">
                                  {safeToFixed(compareValue, 1)}
                                </span>
                              </div>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="any"
                                  placeholder="0.00"
                                  value={reading?.readingValue || ''}
                                  onChange={(e) => handleReadingChange(nozzle.id, e.target.value)}
                                  disabled={nozzle.status !== EquipmentStatusEnum.ACTIVE || !hasFuelPrice}
                                  className={`text-sm h-8 ${!hasFuelPrice ? 'border-red-300 bg-red-50' : ''}`}
                                />
                                {reading?.readingValue && enteredValue > compareValue && (
                                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500">
                                    <Check className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                              {!hasFuelPrice && (
                                <p className="text-xs text-red-600 mt-1">No price set</p>
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
                        })}
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
              {pendingCount > 0 && saleSummary.totalSaleValue > 0 && (
                <>
                  {/* Quick Summary Card */}
                  <Card className="border-2 border-green-200 bg-green-50">
                    <CardContent className="p-3 md:p-4 space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Sale Value</p>
                        <p className="text-xl md:text-2xl font-bold text-green-600 break-all md:break-normal">
                          ₹{saleSummary.totalSaleValue >= 100000 
                            ? `${safeToFixed(saleSummary.totalSaleValue / 100000, 1)}L`
                            : safeToFixed(saleSummary.totalSaleValue, 2)}
                        </p>
                      </div>
                      <div className="flex gap-2 md:gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground truncate">Liters</p>
                          <p className="text-base md:text-lg font-semibold truncate">
                            {saleSummary.totalLiters >= 1000 
                              ? `${safeToFixed(saleSummary.totalLiters / 1000, 1)}K`
                              : safeToFixed(saleSummary.totalLiters, 1)}
                          </p>
                        </div>
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
                  />

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      submitReadingsMutation.isPending ||
                      pendingCount === 0 ||
                      Math.abs(
                        (paymentAllocation.cash + paymentAllocation.online + paymentAllocation.credit) -
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
