import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { apiClient, getToken } from '@/lib/api-client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from '@/components/inputs/CurrencyInput';
import { IndianRupee, Fuel, Gauge } from 'lucide-react';
import { getFuelColors } from '@/lib/fuelColors';

import { useStationPumps } from "@/hooks/useStationPumps";
import { usePumpNozzles } from "@/hooks/usePumpNozzles";
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useIsPremiumStation } from '@/hooks/useIsPremiumStation';

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
  type: 'cash' | 'card' | 'upi' | 'credit';
  payer: string;
  amount: string;
}

interface RefillData {
  station_id: string;
  fuel_type: 'PETROL' | 'DIESEL' | 'CNG' | 'EV';
  quantity_l: number;
  filled_at: string;
}

export default function DataEntry() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [selectedPump, setSelectedPump] = useState<string | null>(null);

  // Manual states
  const [manualPump, setManualPump] = useState<string | null>(null);
  const [manualNozzle, setManualNozzle] = useState<string | null>(null);
  const [previousReading, setPreviousReading] = useState<number | null>(null);
  const [loadingPreviousReading, setLoadingPreviousReading] = useState(false);

  const { session } = useAuth();

  // Use role access to strictly scope stations to the user (owner/employee)
  const { role, stations: userStations, isOwner } = useRoleAccess();

  // Derived dropdown options, use the userStations list from useRoleAccess
  const { data: pumps = [], isLoading: pumpsLoading, error: pumpsError } = useStationPumps(selectedStation || userStations[0]?.id);
  const { data: manualNozzles = [], isLoading: nozzlesLoading, error: nozzlesError } = usePumpNozzles(manualPump);

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 DataEntry Debug:', {
      userStations,
      selectedStation,
      stationForQuery: selectedStation || userStations[0]?.id,
      pumps,
      pumpsLoading,
      pumpsError,
      manualPump,
      manualNozzles,
      nozzlesLoading,
      nozzlesError
    });
  }, [userStations, selectedStation, pumps, pumpsLoading, pumpsError, manualPump, manualNozzles, nozzlesLoading, nozzlesError]);



  // Manual Forms Hookups (as per previous version)
  const {
    register: registerManual,
    handleSubmit: handleSubmitManual,
    formState: { errors: manualErrors },
    reset: resetManual,
    setValue: setManualValue,
    watch: watchManual
  } = useForm<ManualEntryData>({
    defaultValues: {
      station_id: userStations[0]?.id || '',
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
      station_id: userStations[0]?.id || '',
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      type: 'cash',
      payer: '',
      amount: ''
    }
  });

  const {
    register: registerRefill,
    handleSubmit: handleSubmitRefill,
    formState: { errors: refillErrors },
    reset: resetRefill,
    setValue: setRefillValue,
    watch: watchRefill
  } = useForm<RefillData>({
    defaultValues: {
      station_id: userStations[0]?.id || '',
      fuel_type: 'PETROL',
      quantity_l: 0,
      filled_at: format(new Date(), 'yyyy-MM-dd'),
    }
  });

  useEffect(() => {
    // sync forms when stations are ready
    if (userStations.length > 0) {
      setManualValue('station_id', userStations[0].id);
      setTenderValue('station_id', userStations[0].id);
      setRefillValue('station_id', userStations[0].id);
    }
  }, [userStations, setManualValue, setTenderValue, setRefillValue]);

  useEffect(() => {
    // sync forms when stations are ready
    if (userStations.length > 0) {
      setManualValue('station_id', userStations[0].id);
      setTenderValue('station_id', userStations[0].id);
      setRefillValue('station_id', userStations[0].id);
    }
  }, [userStations, setManualValue, setTenderValue, setRefillValue]);

  // -- Manual entry handlers --
  const onSubmitManual = async (data: ManualEntryData) => {
    try {
      setIsSubmitting(true);
      
      // Map to backend expected format
      const payload = {
        nozzleId: data.nozzle_id,
        readingDate: data.reading_date,
        readingValue: data.cumulative_vol,
        readingTime: data.reading_time,
      };

      console.log('📤 Submitting manual reading:', payload);

      const result = await apiClient.post<any>('/readings', payload);
      
      console.log('✅ Reading recorded:', result);
      
      // Show detailed success message
      if (result?.litresSold && result?.totalAmount) {
        toast.success(
          `Reading recorded! ${result.litresSold.toFixed(2)}L sold = ₹${result.totalAmount.toFixed(2)}`,
          { duration: 5000 }
        );
      } else {
        toast.success('Manual reading added successfully');
      }
      
      resetManual();
      setManualPump(null);
      setManualNozzle(null);
      setPreviousReading(null);
    } catch (error: any) {
      console.error('❌ Manual reading error:', error);
      toast.error(error.message || 'Error adding manual reading');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitTender = async (data: TenderEntryData) => {
    try {
      setIsSubmitting(true);
      // TODO: Implement tender/cash handover endpoint
      // For now, use cash handover endpoint: POST /api/v1/handovers
      toast.info('Tender entry feature coming soon!');
      console.log('Tender data:', data);
    } catch (error: any) {
      toast.error('Error adding tender entry');
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
    } catch (error: any) {
      toast.error('Error adding tank refill');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Set default station & reset-dependent dropdowns
  useEffect(() => {
    if (userStations.length > 0 && !selectedStation) {
      console.log('🎯 Setting default station:', userStations[0]);
      setSelectedStation(userStations[0].id);
    }
  }, [userStations, selectedStation]);

  // Reset pumps when station changes
  useEffect(() => {
    setSelectedPump(null);
    setManualPump(null);
    setManualNozzle(null);
  }, [selectedStation]);

  // Manual nozzle reset when pump changes
  useEffect(() => {
    setManualNozzle(null);
  }, [manualPump]);

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
      const response = await apiClient.get<any>(`/readings/previous/${nozzleId}`);
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
              Add readings, tenders, or tank refills quickly.
            </div>
          </div>
          <span className="rounded px-2 py-0.5 text-xs bg-primary/10 text-primary font-medium mt-3 md:mt-0 shadow">
            Fast & easy data entry!
          </span>
        </div>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Station */}
                  <div className="space-y-2">
                    <Label>Station</Label>
                    <Select
                      value={selectedStation ?? ''}
                      onValueChange={value => setSelectedStation(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select station" />
                      </SelectTrigger>
                      <SelectContent>
                        {userStations.map(stn =>
                          <SelectItem key={stn.id} value={stn.id}>{stn.name}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Pump */}
                  <div className="space-y-2">
                    <Label>Pump {pumpsLoading && '(Loading...)'}</Label>
                    <Select
                      value={manualPump ?? ''}
                      onValueChange={value => {
                        console.log('🔧 Pump selected:', value, typeof value);
                        setManualPump(value);
                      }}
                      disabled={!pumps.length || pumpsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={pumps.length ? "Select pump" : "No pumps available"} />
                      </SelectTrigger>
                      <SelectContent>
                        {pumps.map(p => {
                          console.log('🔍 Pump option:', p.id, p.name);
                          return (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name || `Pump ${p.pumpNumber}`}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Nozzle */}
                  <div className="space-y-2">
                    <Label>Nozzle {nozzlesLoading && '(Loading...)'}</Label>
                    <Select
                      value={manualNozzle ?? ''}
                      onValueChange={value => {
                        console.log('🔧 Nozzle selected:', value, typeof value);
                        setManualNozzle(value);
                      }}
                      disabled={!manualNozzles.length || nozzlesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={manualNozzles.length ? "Select nozzle" : "Select pump first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {manualNozzles.map(nz => {
                          console.log('🔍 Nozzle option:', nz.id, nz.nozzleNumber);
                          const colors = getFuelColors(nz.fuelType);
                          return (
                            <SelectItem key={nz.id} value={nz.id}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                                <span>Nozzle {nz.nozzleNumber} - {nz.fuelType}</span>
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
                        Previous: <span className="font-semibold text-primary">{previousReading.toFixed(2)} L</span>
                        {loadingPreviousReading && ' (loading...)'}
                      </p>
                    )}
                    <Input
                      id="manual-volume"
                      type="number"
                      step="0.01"
                      min={previousReading || 0}
                      placeholder={previousReading ? `Enter value > ${previousReading.toFixed(2)}` : 'Enter cumulative volume'}
                      {...registerManual('cumulative_vol', { 
                        required: 'Volume is required', 
                        valueAsNumber: true,
                        min: {
                          value: previousReading || 0,
                          message: `Must be greater than previous reading (${previousReading?.toFixed(2) || 0})`
                        }
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
                <Button disabled={isSubmitting} className="w-full text-base py-2">
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
                        {userStations.map((station) => (
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
                      onValueChange={value => setTenderValue('type', value as 'cash' | 'card' | 'upi' | 'credit')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
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
                        {userStations.map((station) => (
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
                      onValueChange={value => setRefillValue('fuel_type', value as 'PETROL' | 'DIESEL' | 'CNG' | 'EV')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select fuel type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PETROL">Petrol</SelectItem>
                        <SelectItem value="DIESEL">Diesel</SelectItem>
                        <SelectItem value="CNG">CNG</SelectItem>
                        <SelectItem value="EV">EV</SelectItem>
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
