/**
 * Quick Data Entry for Employees - Redesigned (Two-Step: Readings → Transactions)
 * Step 1: Submit nozzle readings (what was sold)
 * Step 2: Submit transaction (how it was paid)
 */

import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { usePumps } from '@/hooks/api';
import { useFuelPricesData } from '@/hooks/useFuelPricesData';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { safeToFixed } from '@/lib/format-utils';
import { PricesRequiredAlert } from '@/components/alerts/PricesRequiredAlert';
import { ReadingSaleCalculation } from '@/components/owner/ReadingSaleCalculation';
import { TransactionPaymentSummary } from '@/components/owner/TransactionPaymentSummary';
import { EquipmentStatusEnum } from '@/core/enums';
import {
  Zap,
  Building2,
  Fuel,
  Check,
  AlertCircle
} from 'lucide-react';

interface ReadingEntry {
  nozzleId: string;
  readingValue: string;
  date: string;
}

interface Creditor {
  id: string;
  name: string;
  businessName?: string;
  currentBalance: number;
  creditLimit: number;
}

interface CreditAllocation {
  creditorId: string;
  amount: number;
}

export default function EmployeeQuickEntry() {
  const { user } = useAuth();
  const { stations: userStations } = useRoleAccess();
  const [readings, setReadings] = useState<Record<string, ReadingEntry>>({});
  const [readingDate, setReadingDate] = useState(new Date().toISOString().split('T')[0]);
  const [step, setStep] = useState<'readings' | 'transaction'>('readings');
  const [submittedReadingIds, setSubmittedReadingIds] = useState<string[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState({ cash: 0, online: 0, credit: 0 });
  const [creditAllocations, setCreditAllocations] = useState<CreditAllocation[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Employees are assigned to ONE station - auto-select it
  const selectedStation = useMemo(() => {
    if (user?.stationId) {
      return user.stationId;
    }
    return userStations?.[0]?.id || '';
  }, [user?.stationId, userStations]);

  // Get station name for display
  const stationName = useMemo(() => {
    const station = userStations?.find(s => s.id === selectedStation);
    return station?.name || 'Your Station';
  }, [selectedStation, userStations]);

  // Fetch pumps for the employee's station
  const { data: pumpsResponse, isLoading: pumpsLoading } = usePumps(selectedStation);
  const pumps = pumpsResponse?.data;

  // Fetch fuel prices for the station
  const { data: fuelPrices, isLoading: pricesLoading } = useFuelPricesData(selectedStation);

  // Fetch creditors for the station
  const { data: creditors = [] } = useQuery<Creditor[]>({
    queryKey: ['creditors', selectedStation],
    queryFn: async () => {
      if (!selectedStation) return [];
      try {
        const response = await apiClient.get(`/stations/${selectedStation}/creditors`);
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
        console.error('Failed to fetch creditors:', error);
        return [];
      }
    },
    enabled: !!selectedStation
  });

  // Calculate sale value summary from readings
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

  // Auto-adjust cash when sale value changes
  useEffect(() => {
    if (saleSummary.totalSaleValue > 0 && step === 'transaction') {
      const allocated = paymentBreakdown.online + paymentBreakdown.credit;
      const newCash = Math.max(0, saleSummary.totalSaleValue - allocated);
      if (Math.abs(newCash - paymentBreakdown.cash) > 0.01) {
        setPaymentBreakdown(prev => ({
          ...prev,
          cash: newCash
        }));
      }
    }
  }, [saleSummary.totalSaleValue, paymentBreakdown.online, paymentBreakdown.credit, step]);

  // STEP 1: Submit readings mutation
  const submitReadingsMutation = useMutation({
    mutationFn: async (data: ReadingEntry[]) => {
      const promises: Promise<any>[] = [];

      data.forEach(entry => {
        // Get nozzle for price calculation
        const nozzle = pumps?.flatMap(p => p.nozzles || []).find(n => n.id === entry.nozzleId);
        const enteredValue = parseFloat(entry.readingValue || '0');
        const lastReading = nozzle?.lastReading ? parseFloat(String(nozzle.lastReading)) : null;
        const initialReading = nozzle?.initialReading ? parseFloat(String(nozzle.initialReading)) : null;
        const compareValue = lastReading !== null && !isNaN(lastReading)
          ? lastReading
          : (initialReading !== null && !isNaN(initialReading) ? initialReading : 0);

        const litres = Math.max(0, enteredValue - (compareValue || 0));
        const priceData = Array.isArray(fuelPrices) 
          ? fuelPrices.find(p => p.fuel_type.toUpperCase() === (nozzle?.fuelType || '').toUpperCase())
          : undefined;
        const price = priceData ? parseFloat(String(priceData.price_per_litre)) : 0;
        const totalAmount = litres * price;

        const readingData = {
          stationId: selectedStation,
          nozzleId: entry.nozzleId,
          readingValue: parseFloat(entry.readingValue),
          readingDate: entry.date,
          pricePerLitre: price,
          totalAmount: totalAmount,
          litresSold: litres,
          notes: `Reading entered by ${user?.name || 'Employee'}`
        };

        if (!readingData.stationId) {
          throw new Error('Station ID is required');
        }
        if (!readingData.nozzleId) {
          throw new Error('Nozzle ID is required');
        }

        promises.push(apiClient.post('/readings', readingData));
      });

      const results = await Promise.all(promises);
      // Extract reading IDs from responses
      const ids = results.map(r => r.data?.id).filter(Boolean);
      return ids;
    },
    onSuccess: (readingIds) => {
      toast({
        title: 'Readings Saved ✓',
        description: `${Object.keys(readings).length} reading(s) submitted successfully`,
        variant: 'success'
      });
      setSubmittedReadingIds(readingIds);
      setStep('transaction');
    },
    onError: (error: unknown) => {
      let message = 'Failed to save readings';
      if (error instanceof Error) {
        message = error.message;
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // STEP 2: Submit transaction mutation
  const submitTransactionMutation = useMutation({
    mutationFn: async () => {
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
        stationId: selectedStation,
        transactionDate: readingDate,
        readingIds: submittedReadingIds,
        paymentBreakdown: paymentBreakdown,
        creditAllocations: creditAllocations.filter(c => c.amount > 0),
        notes: `Transaction created by ${user?.name || 'Employee'}`
      };

      return apiClient.post('/transactions', transactionData);
    },
    onSuccess: () => {
      toast({
        title: 'Transaction Created ✓',
        description: `Payment breakdown (₹${safeToFixed(saleSummary.totalSaleValue, 2)}) recorded successfully`,
        variant: 'success'
      });
      // Reset everything
      setReadings({});
      setPaymentBreakdown({ cash: 0, online: 0, credit: 0 });
      setCreditAllocations([]);
      setSubmittedReadingIds([]);
      setStep('readings');
      setReadingDate(new Date().toISOString().split('T')[0]);
      // Refetch data
      queryClient.invalidateQueries({ queryKey: ['pumps', selectedStation] });
      queryClient.invalidateQueries({ queryKey: ['pumps-data', selectedStation] });
      queryClient.refetchQueries({ queryKey: ['pumps', selectedStation] });
      queryClient.refetchQueries({ queryKey: ['pumps-data', selectedStation] });
      queryClient.invalidateQueries({ queryKey: ['daily-sales'] });
      queryClient.invalidateQueries({ queryKey: ['readings'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', selectedStation] });
    },
    onError: (error: unknown) => {
      let message = 'Failed to create transaction';
      if (error instanceof Error) {
        message = error.message;
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
        date: readingDate
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

  const handleSubmitReadings = () => {
    const entries = Object.values(readings).filter(r => r.readingValue && parseFloat(r.readingValue) > 0);
    if (entries.length === 0) {
      toast({
        title: 'No readings entered',
        description: 'Please enter at least one reading',
        variant: 'destructive'
      });
      return;
    }

    const missingPrices = entries.filter(e => !hasPriceForFuelType(
      pumps?.flatMap(p => p.nozzles || []).find(n => n.id === e.nozzleId)?.fuelType || ''
    ));
    
    if (missingPrices.length > 0) {
      toast({
        title: 'Missing Fuel Prices',
        description: 'Some nozzles don\'t have fuel prices set. Contact your manager.',
        variant: 'destructive'
      });
      return;
    }

    submitReadingsMutation.mutate(entries);
  };

  const pendingCount = Object.keys(readings).length;
  const totalNozzles = pumps?.reduce((sum, pump) => sum + (pump.nozzles?.length || 0), 0) || 0;

  // Show loading state
  if (!selectedStation) {
    return (
      <div className="container mx-auto p-3 sm:p-6 max-w-7xl">
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Building2 className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">No Station Assigned</h3>
                <p className="text-sm text-muted-foreground">
                  Please contact your manager to be assigned to a station
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl">
      {/* Header with Step Indicator */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 mb-1">
          <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
          Quick Entry
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-3">
          Enter nozzle readings for <span className="font-medium">{stationName}</span>
        </p>
        {/* Step indicator */}
        <div className="flex gap-2 items-center text-xs">
          <Badge variant={step === 'readings' ? 'default' : 'outline'}>Step 1: Readings</Badge>
          <span className="text-muted-foreground">→</span>
          <Badge variant={step === 'transaction' ? 'default' : 'outline'}>Step 2: Payment</Badge>
        </div>
      </div>

      <PricesRequiredAlert stationId={selectedStation} showIfMissing={true} compact={true} />

      {/* STEP 1: READINGS ENTRY */}
      {step === 'readings' && (
        <>
          {/* Date Selection */}
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs sm:text-sm text-muted-foreground">Station</Label>
                  <div className="mt-1.5 flex items-center gap-2 p-2 bg-gray-50 rounded-md border">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{stationName}</span>
                  </div>
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
                    <span className="font-semibold text-gray-700">{totalNozzles} nozzles</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Readings Entry */}
          {pumpsLoading || pricesLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-sm text-muted-foreground">
                  {pumpsLoading ? 'Loading pumps...' : 'Loading fuel prices...'}
                </div>
              </CardContent>
            </Card>
          ) : pumps && pumps.length > 0 ? (
            <>
              {getMissingFuelTypes().length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-900">
                    ⚠ Missing prices for: <span className="text-amber-700 font-bold">{getMissingFuelTypes().join(', ')}</span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Pump/Nozzles List */}
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

                              return (
                                <div key={nozzle.id} className="border rounded-lg p-2.5 bg-white">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <Label className="text-xs font-semibold">
                                      Nozzle {nozzle.nozzleNumber} - {nozzle.fuelType}
                                      {!hasFuelPrice && <span className="text-red-500 ml-1">*</span>}
                                    </Label>
                                    <span className="text-xs text-muted-foreground">
                                      Last: {safeToFixed(compareValue, 1)}
                                    </span>
                                  </div>
                                  <div className="relative">
                                    <Input
                                      type="number"
                                      step="any"
                                      placeholder="Enter current reading"
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
                                    <p className="text-xs text-red-600 mt-1">Price not set - contact manager</p>
                                  )}
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

                {/* Summary Card */}
                <div className="lg:col-span-1">
                  {pendingCount > 0 && saleSummary.totalSaleValue > 0 ? (
                    <Card className="border-2 border-green-200 bg-green-50 sticky top-4">
                      <CardContent className="p-3 md:p-4 space-y-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Total Sale Value</p>
                          <p className="text-2xl font-bold text-green-600">
                            ₹{saleSummary.totalSaleValue >= 100000 
                              ? `${safeToFixed(saleSummary.totalSaleValue / 100000, 1)}L`
                              : safeToFixed(saleSummary.totalSaleValue, 2)}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Liters</p>
                            <p className="text-lg font-semibold">
                              {saleSummary.totalLiters >= 1000 
                                ? `${safeToFixed(saleSummary.totalLiters / 1000, 1)}K`
                                : safeToFixed(saleSummary.totalLiters, 1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Readings</p>
                            <p className="text-lg font-semibold">{pendingCount}/{totalNozzles}</p>
                          </div>
                        </div>
                        <Button
                          onClick={handleSubmitReadings}
                          disabled={submitReadingsMutation.isPending || pendingCount === 0}
                          size="lg"
                          className="w-full"
                        >
                          {submitReadingsMutation.isPending ? (
                            'Saving...'
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Submit Readings
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="p-4 text-center">
                        <Fuel className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground">Enter readings to continue</p>
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
                  <Fuel className="w-16 h-16 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No Pumps Found</h3>
                    <p className="text-sm text-muted-foreground">
                      No pumps are configured for this station. Contact your manager.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* STEP 2: PAYMENT ALLOCATION */}
      {step === 'transaction' && submittedReadingIds.length > 0 && (
        <div className="space-y-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <p className="text-xs font-semibold text-blue-900">
                ✓ {submittedReadingIds.length} reading(s) recorded. Now allocate the payment breakdown.
              </p>
            </CardContent>
          </Card>

          <TransactionPaymentSummary
            totalSaleValue={saleSummary.totalSaleValue}
            paymentBreakdown={paymentBreakdown}
            onPaymentChange={setPaymentBreakdown}
            creditAllocations={creditAllocations}
            onCreditAllocationsChange={setCreditAllocations}
            creditors={creditors}
            isLoading={submitTransactionMutation.isPending}
          />

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setStep('readings');
                setSubmittedReadingIds([]);
              }}
              variant="outline"
              disabled={submitTransactionMutation.isPending}
              className="flex-1"
            >
              Back to Readings
            </Button>
            <Button
              onClick={() => submitTransactionMutation.mutate()}
              disabled={
                submitTransactionMutation.isPending ||
                Math.abs(
                  (paymentBreakdown.cash + paymentBreakdown.online + paymentBreakdown.credit) -
                  saleSummary.totalSaleValue
                ) > 0.01
              }
              className="flex-1"
            >
              {submitTransactionMutation.isPending ? 'Creating...' : 'Confirm Payment'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
