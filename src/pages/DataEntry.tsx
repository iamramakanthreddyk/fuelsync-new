import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

import { FuelType, FuelTypeEnum, PaymentMethod, PaymentMethodEnum } from '@/core/enums';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurrencyInput } from '@/components/inputs/CurrencyInput';
import { IndianRupee, Fuel, Gauge } from 'lucide-react';
import { safeToFixed } from '@/lib/format-utils';
import { PricesRequiredAlert } from '@/components/alerts/PricesRequiredAlert';
import { useFuelPricesData } from '@/hooks/useFuelPricesData';
import { cashHandoverService } from '@/services/tenderService';
import { getFuelColors } from '@/lib/fuelColors';
import { PaymentSplit, SaleCalculation } from '@/components/readings';
import type { PaymentSplitData } from '@/components/readings';
import { Checkbox } from '@/components/ui/checkbox';

import { useStationPumps } from "@/hooks/useStationPumps";
import { useRoleAccess, StationAccess } from '@/hooks/useRoleAccess';


interface ManualEntryData {
  station_id: string;
  nozzle_id: string;
  cumulative_vol: number;
  reading_date: string;
  reading_time: string;
}

interface TenderEntryData {
  station_id: string;
  entry_date: string;
  type: PaymentMethod;
  payer: string;
  amount: string;
}

interface RefillData {
  station_id: string;
  fuel_type: FuelType;
  quantity_l: number;
  filled_at: string;
}

export default function DataEntry() {
  // Fetch global fuel prices for the selected station
  const { data: fuelPrices } = useFuelPricesData();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  // Manual states
  const [manualNozzle, setManualNozzle] = useState<string | null>(null);
  const [previousReading, setPreviousReading] = useState<number | null>(null);
  const [loadingPreviousReading, setLoadingPreviousReading] = useState(false);
  
  // Current reading for calculations
  const [currentReadingValue, setCurrentReadingValue] = useState<number>(0);
  
  // Payment split state
  const [paymentSplit, setPaymentSplit] = useState<PaymentSplitData | null>(null);
  const [showCreditOption, setShowCreditOption] = useState(false);

  useAuth();

  const queryClient = useQueryClient();

  // Use role access to strictly scope stations to the user (owner/employee)
  const { stations: userStations, canAccessAllStations } = useRoleAccess();

  // Fetch all stations for admins
  const { data: allStations = [] } = useQuery({
    queryKey: ['all-stations'],
    queryFn: async () => {
      const response = await apiClient.get<any>('/api/v1/stations');
      if (response && typeof response === 'object') {
        if ('data' in response && Array.isArray(response.data)) {
          return response.data as StationAccess[];
        }
        if (Array.isArray(response)) {
          return response as StationAccess[];
        }
      }
      return [];
    },
    enabled: canAccessAllStations
  });

  // Use allStations for admins, userStations for others
  const availableStations = canAccessAllStations ? allStations : userStations;

  // Derived dropdown options, use the availableStations list
  const { data: pumps = [], isLoading: pumpsLoading, error: pumpsError } = useStationPumps(selectedStation || availableStations[0]?.id);
  
  // Get all nozzles for the selected station (for simplified manual entry)
  const { data: allNozzles = [] } = useQuery({
    queryKey: ['all-nozzles', selectedStation || availableStations[0]?.id],
    queryFn: async () => {
      const stationId = selectedStation || availableStations[0]?.id;
      if (!stationId) return [];
      
      try {
        const response = await apiClient.get(`/stations/${stationId}/nozzles`);
        return Array.isArray(response) ? response : (response as any)?.data || [];
      } catch (error) {
        console.error('Failed to fetch all nozzles:', error);
        return [];
      }
    },
    enabled: !!(selectedStation || availableStations[0]?.id)
  });
  
  // Get selected nozzle details for fuel type and price (MUST be after allNozzles is defined)
  const selectedNozzleData = useMemo(() => {
    if (!manualNozzle || !allNozzles?.length) return null;
    return allNozzles.find((n: any) => n.id === manualNozzle);
  }, [manualNozzle, allNozzles]);
  
  // Get fuel price for selected nozzle
  const currentFuelPrice = useMemo(() => {
    if (!selectedNozzleData?.fuelType || !fuelPrices?.length) return 0;
    const priceRecord = fuelPrices.find(
      (p) => p.fuel_type?.toUpperCase() === selectedNozzleData.fuelType?.toUpperCase()
    );
    return priceRecord?.price_per_litre || 0;
  }, [selectedNozzleData, fuelPrices]);
  
  // Calculate sale values
  const saleCalculation = useMemo(() => {
    const prev = previousReading || 0;
    const curr = currentReadingValue || 0;
    const litresSold = Math.max(0, curr - prev);
    const saleValue = litresSold * currentFuelPrice;
    const isValid = curr >= prev && litresSold > 0;
    
    return {
      previousReading: prev,
      currentReading: curr,
      litresSold,
      saleValue,
      pricePerLitre: currentFuelPrice,
      isValid
    };
  }, [previousReading, currentReadingValue, currentFuelPrice]);

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 DataEntry Debug:', {
      availableStations,
      selectedStation,
      stationForQuery: selectedStation || availableStations[0]?.id,
      pumps,
      pumpsLoading,
      pumpsError,
      manualNozzle,
      allNozzles
    });
  }, [availableStations, selectedStation, pumps, pumpsLoading, pumpsError, manualNozzle, allNozzles]);



  // ...existing code...
  // You can now use fuelPrices and isPricesLoading anywhere in this component
  // ...existing code...
  const {
    register: registerManual,
    handleSubmit: handleSubmitManual,
    formState: { errors: manualErrors },
    reset: resetManual,
    setValue: setManualValue,
    // watch: watchManual
  } = useForm<ManualEntryData>({
    defaultValues: {
      station_id: availableStations[0]?.id || '',
      nozzle_id: '',
      cumulative_vol: 0,
      reading_date: format(new Date(), 'yyyy-MM-dd'),
      reading_time: format(new Date(), 'HH:mm'),
    }
  });

  const {
    register: registerTender,
    handleSubmit: handleSubmitTender,
    formState: { errors: tenderErrors },
    reset: resetTender,
    setValue: setTenderValue,
    watch: watchTender
  } = useForm<TenderEntryData>({
    defaultValues: {
      station_id: availableStations[0]?.id || '',
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      type: PaymentMethodEnum.CASH,
      payer: '',
      amount: ''
    }
  });

  const {
    register: registerRefill,
    handleSubmit: handleSubmitRefill,
    formState: { errors: refillErrors },
    // reset: resetRefill,
    setValue: setRefillValue,
    watch: watchRefill
  } = useForm<RefillData>({
    defaultValues: {
      station_id: availableStations[0]?.id || '',
      fuel_type: FuelTypeEnum.DIESEL,
      quantity_l: 0,
      filled_at: format(new Date(), 'yyyy-MM-dd'),
    }
  });

  useEffect(() => {
    // sync forms when stations are ready
    if (availableStations.length > 0) {
      setManualValue('station_id', availableStations[0].id);
      setTenderValue('station_id', availableStations[0].id);
      setRefillValue('station_id', availableStations[0].id);
    }
  }, [availableStations, setManualValue, setTenderValue, setRefillValue]);

  // -- Manual entry handlers --
  const onSubmitManual = async (data: ManualEntryData) => {
    try {
      setIsSubmitting(true);
      
      // Validate required fields
      if (!data.station_id) {
        toast.error('Please select a station');
        return;
      }
      
      if (!data.nozzle_id) {
        toast.error('Please select a nozzle');
        return;
      }
      
      // Validate payment split only if payment details are being recorded
      if (showCreditOption && saleCalculation.saleValue > 0 && !paymentSplit?.isBalanced) {
        toast.error('Please ensure payment amounts balance with sale value');
        return;
      }
      
      // Map to backend expected format with payment breakdown
      const payload = {
        stationId: data.station_id,
        nozzleId: data.nozzle_id,
        readingDate: data.reading_date,
        readingValue: data.cumulative_vol,
        readingTime: data.reading_time,
        // Include calculated values to ensure backend uses same calculations
        pricePerLitre: saleCalculation.pricePerLitre,
        totalAmount: saleCalculation.saleValue,
        litresSold: saleCalculation.litresSold,
        // Include payment breakdown if sale has value
        ...(saleCalculation.saleValue > 0 && paymentSplit && {
          paymentBreakdown: {
            cash: paymentSplit.cash,
            online: paymentSplit.online,
            credit: paymentSplit.credit
          },
          cashAmount: paymentSplit.cash,
          onlineAmount: paymentSplit.online,
          creditAmount: paymentSplit.credit
        })
      };

      console.log('📤 Submitting manual reading with payment:', payload);

      const result = await apiClient.post<{ litresSold?: number; totalAmount?: number }>('/readings', payload);

      console.log('✅ Reading recorded:', result);

      // Invalidate relevant queries so UI reflects the new reading
      try {
        // Broadly invalidate readings and analytics queries
        queryClient.invalidateQueries({ queryKey: ['readings'] });
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
        // Invalidate station-specific pump data so latest readings refresh
        if (data && typeof data === 'object' && data !== null && 'nozzleId' in data) {
          // station id may not be present on this payload; invalidate 'station-pumps' generally
          queryClient.invalidateQueries({ queryKey: ['station-pumps'] });
          queryClient.invalidateQueries({ queryKey: ['readings', 'latest'] });
        }
      } catch (err) {
        // If react-query isn't available for some reason, continue gracefully
        console.warn('QueryClient invalidation failed', err);
      }

      // Show detailed success message
      if (result?.litresSold && result?.totalAmount) {
        toast.success(
          `Reading recorded! ${safeToFixed(result.litresSold)}L sold = ₹${safeToFixed(result.totalAmount)}`,
          { duration: 5000 }
        );
      } else {
        toast.success('Manual reading added successfully');
      }

      resetManual();
      setManualNozzle(null);
      setPreviousReading(null);
      setCurrentReadingValue(0);
      setPaymentSplit(null);
      setShowCreditOption(false);
    } catch (error: unknown) {
      console.error('❌ Manual reading error:', error);
      let message = 'Error adding manual reading';
      if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
        message = (error as { message: string }).message;
      }
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitTender = async (data: TenderEntryData) => {
    try {
      setIsSubmitting(true);
      
      // Create a cash handover record for tender entry
      // This records cash/card/upi/credit collections
      const amount = parseFloat(data.amount) || 0;
      if (amount <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      await cashHandoverService.createHandover({
        stationId: data.station_id,
        handoverType: 'shift_collection',
        handoverDate: data.entry_date,
        expectedAmount: amount,
        notes: `${data.type.toUpperCase()} collection from ${data.payer || 'unknown'}`
      });

      toast.success(`Tender entry recorded: ₹${safeToFixed(amount)} (${data.type})`);
      resetTender();
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error: unknown) {
      let message = 'Error adding tender entry';
      if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
        message = (error as { message: string }).message;
      }
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitRefill = async (data: RefillData) => {
    try {
      setIsSubmitting(true);
      // TODO: Need to get tank ID for the station and fuel type
      // Endpoint: POST /api/v1/tanks/:id/refill
      toast.info('Tank refill feature coming soon!');
      console.log('Refill data:', data);
    } catch (error: unknown) {
      let message = 'Error adding tank refill';
      if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
        message = (error as { message: string }).message;
      }
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Set default station & reset-dependent dropdowns
  useEffect(() => {
    if (availableStations.length > 0 && !selectedStation) {
      console.log('🎯 Setting default station:', availableStations[0]);
      setSelectedStation(availableStations[0].id);
    }
  }, [availableStations, selectedStation]);

  // Reset when station changes
  useEffect(() => {
    setManualNozzle(null);
  }, [selectedStation]);

  // Sync manualNozzle with form field
  useEffect(() => {
    if (manualNozzle) {
      setManualValue('nozzle_id', manualNozzle);
      // Fetch previous reading for this nozzle
      fetchPreviousReading(manualNozzle);
    } else {
      setPreviousReading(null);
    }
  }, [manualNozzle, setManualValue]);

  // Fetch previous reading for a nozzle
  const fetchPreviousReading = async (nozzleId: string) => {
    try {
      setLoadingPreviousReading(true);
      // apiClient unwraps {success, data} to just data
      const response = await apiClient.get<{ previousReading?: string }>(`/readings/previous/${nozzleId}`);
      console.log('📊 Previous reading response:', response);
      
      if (response && response.previousReading !== undefined) {
        const prevValue = parseFloat(response.previousReading);
        setPreviousReading(prevValue);
        console.log('📊 Set previous reading to:', prevValue);
      } else {
        setPreviousReading(0); // No previous reading, starting from 0
        console.log('📊 No previous reading found, starting from 0');
      }
    } catch (error) {
      console.error('❌ Failed to fetch previous reading:', error);
      setPreviousReading(0);
    } finally {
      setLoadingPreviousReading(false);
    }
  };

  // Sync selectedStation with form fields
  useEffect(() => {
    if (selectedStation) {
      setManualValue('station_id', selectedStation);
      setTenderValue('station_id', selectedStation);
      setRefillValue('station_id', selectedStation);
    }
  }, [selectedStation, setManualValue, setTenderValue, setRefillValue]);

  // UI Render
  return (
    <div className="flex flex-col items-center bg-gradient-to-tr from-primary/10 via-muted/40 to-secondary/20 min-h-[100vh] py-10 px-2 transition-all duration-500">
      <div className="w-full max-w-4xl animate-fade-in">
        <div className="mb-8 flex flex-col md:flex-row justify-between md:items-center">
          <div>
            <div className="flex items-center gap-2 text-2xl font-semibold text-primary">
              <Gauge className="w-7 h-7 text-fuel-orange" />
              Data Entry <span className="text-fuel-orange text-lg">•</span>
            </div>
            <div className="mt-1 text-muted-foreground text-base">
              {availableStations.length === 1 
                ? `Add readings, tenders, or tank refills for ${availableStations[0].name}`
                : 'Add readings, tenders, or tank refills quickly.'
              }
            </div>
          </div>
          <span className="rounded px-2 py-0.5 text-xs bg-primary/10 text-primary font-medium mt-3 md:mt-0 shadow">
            Fast & easy data entry!
          </span>
        </div>
        
        {/* Show alert if prices are not set */}
        <PricesRequiredAlert showIfMissing={true} compact={true} />
        
        <Tabs defaultValue="manual" className="space-y-6 w-full">
          {/* TabsList */}
          <TabsList className="grid grid-cols-3 gap-2 md:gap-4 w-full mx-auto mb-4">
            <TabsTrigger value="manual" className="flex flex-col items-center gap-1 text-sm font-medium">
              <Gauge className="w-5 h-5 text-fuel-orange" />
              <span className="hidden md:inline text-fuel-orange">Manual Reading</span>
            </TabsTrigger>
            <TabsTrigger value="tender" className="flex flex-col items-center gap-1 text-sm font-medium">
              <IndianRupee className="w-5 h-5 text-green-600" />
              <span className="hidden md:inline text-green-700">Tender Entry</span>
            </TabsTrigger>
            <TabsTrigger value="refill" className="flex flex-col items-center gap-1 text-sm font-medium">
              <Fuel className="w-5 h-5 text-yellow-500" />
              <span className="hidden md:inline text-yellow-700">Tank Refill</span>
            </TabsTrigger>
          </TabsList>
          {/* Manual Tab */}
          <TabsContent value="manual">
            <div className="rounded-xl p-6 mb-6 shadow-sm bg-orange-50 border border-border/30">
              <h3 className="text-fuel-orange text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="inline-block w-6 h-6 bg-fuel-orange rounded-full flex items-center justify-center text-white text-sm font-bold">M</span>
                Manual Reading
              </h3>
              <form onSubmit={handleSubmitManual(onSubmitManual)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Station */}
                  <div className="space-y-2">
                    <Label>Station</Label>
                    <Select
                      value={selectedStation ?? ''}
                      onValueChange={value => {
                        setSelectedStation(value);
                        setManualValue('station_id', value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select station" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStations.map(stn =>
                          <SelectItem key={stn.id} value={stn.id}>{stn.name}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Nozzle - Direct selection from all nozzles */}
                  <div className="space-y-2">
                    <Label>Nozzle</Label>
                    <Select
                      value={manualNozzle ?? ''}
                      onValueChange={value => {
                        console.log('🔧 Nozzle selected:', value, typeof value);
                        setManualNozzle(value);
                      }}
                      disabled={!allNozzles.length}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={allNozzles.length ? "Select nozzle" : "Select station first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {allNozzles.map((nz: any) => {
                          console.log('🔍 All nozzle option:', nz.id, nz.nozzleNumber);
                          const colors = getFuelColors(nz.fuelType);
                          return (
                            <SelectItem key={nz.id} value={nz.id}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                                <span>Pump {nz.pump?.pumpNumber || nz.pumpNumber || '?'} - Nozzle {nz.nozzleNumber} - {nz.fuelType}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Volume, Date, Time */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Cumulative Volume (L)</Label>
                    {previousReading !== null && (
                      <p className="text-xs text-muted-foreground">
                        Previous: <span className="font-semibold text-primary">{safeToFixed(previousReading)} L</span>
                        {loadingPreviousReading && ' (loading...)'}
                      </p>
                    )}
                    <Input
                      id="manual-volume"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Enter cumulative volume"
                      {...registerManual('cumulative_vol', { 
                        required: 'Volume is required', 
                        valueAsNumber: true,
                        min: { value: 0, message: 'Volume must be positive' }
                      })}
                    />
                    {manualErrors.cumulative_vol && (
                      <p className="text-sm text-red-600">{manualErrors.cumulative_vol.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      id="manual-date"
                      type="date"
                      {...registerManual('reading_date', { required: 'Date is required' })}
                    />
                    {manualErrors.reading_date && (
                      <p className="text-sm text-red-600">{manualErrors.reading_date.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      id="manual-time"
                      type="time"
                      {...registerManual('reading_time', { required: 'Time is required' })}
                    />
                    {manualErrors.reading_time && (
                      <p className="text-sm text-red-600">{manualErrors.reading_time.message}</p>
                    )}
                  </div>
                </div>
                
                {/* Sale Calculation Display */}
                {manualNozzle && currentFuelPrice > 0 && (
                  <SaleCalculation
                    previousReading={saleCalculation.previousReading}
                    currentReading={saleCalculation.currentReading}
                    pricePerLitre={saleCalculation.pricePerLitre}
                    fuelType={selectedNozzleData?.fuelType}
                    className="mt-4"
                  />
                )}
                
                {/* Optional Payment Split */}
                {saleCalculation.isValid && saleCalculation.saleValue > 0 && (
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="show-payment"
                        checked={showCreditOption}
                        onCheckedChange={(checked) => setShowCreditOption(!!checked)}
                      />
                      <Label htmlFor="show-payment" className="text-sm text-muted-foreground cursor-pointer">
                        Record payment details (optional)
                      </Label>
                    </div>
                    
                    {showCreditOption && (
                      <PaymentSplit
                        totalAmount={saleCalculation.saleValue}
                        onPaymentChange={setPaymentSplit}
                        showCredit={true}
                      />
                    )}
                  </div>
                )}
                
                <Button 
                  disabled={isSubmitting} 
                  className="w-full text-base py-2"
                >
                  {isSubmitting ? 'Submitting...' : 'Add Manual Reading'}
                </Button>
              </form>
            </div>
          </TabsContent>
          {/* --- Tender Entry --- */}
          <TabsContent value="tender">
            <div className="rounded-xl p-6 mb-6 shadow-sm bg-green-50 border border-border/30">
              <h3 className="text-green-700 text-xl font-semibold mb-4 flex items-center gap-2">
                <IndianRupee className="w-6 h-6 text-green-700" />
                Tender Entry
              </h3>
              <form onSubmit={handleSubmitTender(onSubmitTender)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="tender-station">Station</Label>
                    <Select 
                      value={watchTender('station_id') || ''} 
                      onValueChange={(value) => setTenderValue('station_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select station" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStations.map((station) => (
                          <SelectItem key={station.id} value={station.id}>
                            {station.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tender-date">Date</Label>
                    <Input
                      id="tender-date"
                      type="date"
                      {...registerTender('entry_date', { required: 'Date is required' })}
                    />
                    {tenderErrors.entry_date && (
                      <p className="text-sm text-red-600">{tenderErrors.entry_date.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tender-type">Payment Type</Label>
                    <Select 
                      value={watchTender('type') || ''} 
                      onValueChange={value => setTenderValue('type', value as PaymentMethod)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PaymentMethodEnum.CASH}>Cash</SelectItem>
                        <SelectItem value={PaymentMethodEnum.CARD}>Card</SelectItem>
                        <SelectItem value={PaymentMethodEnum.UPI}>UPI</SelectItem>
                        <SelectItem value={PaymentMethodEnum.CREDIT}>Credit</SelectItem>
                      </SelectContent>
                    </Select>
                    {tenderErrors.type && (
                      <p className="text-sm text-red-600">{tenderErrors.type.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tender-amount">Amount</Label>
                    <CurrencyInput
                      value={watchTender('amount')}
                      onChange={value => setTenderValue('amount', value)}
                      placeholder="₹0.00"
                    />
                    {tenderErrors.amount && (
                      <p className="text-sm text-red-600">{tenderErrors.amount.message}</p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="tender-payer">Payer Name</Label>
                    <Input
                      id="tender-payer"
                      placeholder="Enter payer name"
                      {...registerTender('payer', { required: 'Payer name is required' })}
                    />
                    {tenderErrors.payer && (
                      <p className="text-sm text-red-600">{tenderErrors.payer.message}</p>
                    )}
                  </div>
                </div>
                <Button disabled={isSubmitting} className="w-full text-base py-2">
                  {isSubmitting ? 'Submitting...' : 'Add Tender Entry'}
                </Button>
              </form>
            </div>
          </TabsContent>
          {/* --- Refill Entry --- */}
          <TabsContent value="refill">
            <div className="rounded-xl p-6 mb-6 shadow-sm bg-yellow-50 border border-border/30">
              <h3 className="text-yellow-700 text-xl font-semibold mb-4 flex items-center gap-2">
                <Fuel className="w-6 h-6 text-yellow-500" />
                Tank Refill
              </h3>
              <form onSubmit={handleSubmitRefill(onSubmitRefill)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="refill-station">Station</Label>
                    <Select
                      value={watchRefill('station_id') || ''}
                      onValueChange={(value) => setRefillValue('station_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select station" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStations.map((station) => (
                          <SelectItem key={station.id} value={station.id}>
                            {station.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="refill-fuel">Fuel Type</Label>
                    <Select
                      value={watchRefill('fuel_type')}
                      onValueChange={value => setRefillValue('fuel_type', value as FuelType)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select fuel type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={FuelTypeEnum.PETROL}>Petrol</SelectItem>
                        <SelectItem value={FuelTypeEnum.DIESEL}>Diesel</SelectItem>
                        <SelectItem value={FuelTypeEnum.CNG}>CNG</SelectItem>
                        <SelectItem value={FuelTypeEnum.LPG}>LPG</SelectItem>
                        <SelectItem value={FuelTypeEnum.PREMIUM_PETROL}>Premium Petrol</SelectItem>
                        <SelectItem value={FuelTypeEnum.PREMIUM_DIESEL}>Premium Diesel</SelectItem>
                        <SelectItem value={FuelTypeEnum.EV_CHARGING}>EV Charging</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="refill-quantity">Quantity (L)</Label>
                    <Input
                      id="refill-quantity"
                      type="number"
                      step="100"
                      {...registerRefill('quantity_l', { required: 'Quantity is required', valueAsNumber: true })}
                    />
                    {refillErrors.quantity_l && (
                      <p className="text-sm text-red-600">{refillErrors.quantity_l.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="refill-date">Filled At</Label>
                    <Input
                      id="refill-date"
                      type="date"
                      {...registerRefill('filled_at', { required: 'Date is required' })}
                    />
                    {refillErrors.filled_at && (
                      <p className="text-sm text-red-600">{refillErrors.filled_at.message}</p>
                    )}
                  </div>
                </div>
                <Button disabled={isSubmitting} className="w-full text-base py-2">
                  {isSubmitting ? 'Submitting...' : 'Add Tank Refill'}
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
