/**
 * Station Detail Page
 * Comprehensive view of a single station with pumps, nozzles, fuel prices
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toFixedNumber } from '@/lib/numberFormat';
import { formatDateISO, formatDateLocal, formatDateTimeLocal } from '@/lib/dateFormat';
import { safeToFixed } from '@/lib/format-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { debounce } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { extractApiArray } from '@/lib/api-response';
import { getFuelBadgeClasses } from '@/lib/fuelColors';
import { Station } from '@/types/api';
import { StationSettingsForm } from '@/components/owner/StationSettingsForm';
import {
  ArrowLeft,
  Plus,
  Edit,
  Fuel,
  Settings,
  IndianRupee,
  CreditCard
} from 'lucide-react';

// Import enums and types
import {
  type FuelType,
  type EquipmentStatus,
  type PaymentMethod,
  FuelTypeEnum,
  EquipmentStatusEnum,
  PaymentMethodEnum
} from '@/core/enums';

// Define reading payment types (subset of PaymentMethod used for readings)
 

interface Creditor {
  id: string;
  name: string;
  phone: string;
  email?: string;
  creditLimit: number;
  currentBalance: number;
  vehicleNumber?: string;
}

export default function StationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isPumpDialogOpen, setIsPumpDialogOpen] = useState(false);
  const [isNozzleDialogOpen, setIsNozzleDialogOpen] = useState(false);
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [isCreditorDialogOpen, setIsCreditorDialogOpen] = useState(false);
  const [isEditPumpDialogOpen, setIsEditPumpDialogOpen] = useState(false);
  const [isEditNozzleDialogOpen, setIsEditNozzleDialogOpen] = useState(false);
  
  const [selectedPump, setSelectedPump] = useState<Pump | null>(null);
  const [selectedNozzle, setSelectedNozzle] = useState<Nozzle | null>(null);

  // Get default fuel type: default to petrol (allow multiple nozzles of same type)
  const getDefaultFuelType = (): FuelType => {
    return FuelTypeEnum.PETROL;
  };

  const [pumpForm, setPumpForm] = useState({
    pumpNumber: '',
    name: '',
    status: EquipmentStatusEnum.ACTIVE as EquipmentStatus
  });

  const [editPumpForm, setEditPumpForm] = useState<{
    name: string;
    status: EquipmentStatus;
    notes: string;
  }>({
    name: '',
    status: EquipmentStatusEnum.ACTIVE,
    notes: ''
  });

  const [nozzleForm, setNozzleForm] = useState({
    fuelType: FuelTypeEnum.PETROL as FuelType,
    initialReading: ''
  });

  const [editNozzleForm, setEditNozzleForm] = useState<{
    status: EquipmentStatus;
    notes: string;
  }>({
    status: EquipmentStatusEnum.ACTIVE,
    notes: ''
  });

  

  const [priceForm, setPriceForm] = useState({
    fuelType: FuelTypeEnum.PETROL as FuelType,
    price: '',
    effectiveFrom: formatDateISO(new Date())
  });


  type CreditorForm = {
    name: string;
    phone: string;
    email: string;
    creditLimit: string;
    vehicleNumber: string;
  };
  const [creditorForm, setCreditorForm] = useState<CreditorForm>({
    name: '',
    phone: '',
    email: '',
    creditLimit: '',
    vehicleNumber: ''
  });

  // Debounced handlers for text fields
  const debouncedSetCreditorName = debounce((...args: unknown[]) => {
    const value = args[0] as string;
    setCreditorForm((prev) => ({ ...prev, name: value }));
  }, 200);
  const debouncedSetCreditorPhone = debounce((...args: unknown[]) => {
    const value = args[0] as string;
    setCreditorForm((prev) => ({ ...prev, phone: value }));
  }, 200);
  const debouncedSetCreditorEmail = debounce((...args: unknown[]) => {
    const value = args[0] as string;
    setCreditorForm((prev) => ({ ...prev, email: value }));
  }, 200);
  const debouncedSetCreditorVehicle = debounce((...args: unknown[]) => {
    const value = args[0] as string;
    setCreditorForm((prev) => ({ ...prev, vehicleNumber: value }));
  }, 200);

  // Fetch station details
  const { data: station, isLoading: stationLoading } = useQuery({
    queryKey: ['station', id],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Station }>(`/stations/${id}`);
      return response.data;
    },
    enabled: !!id
  });

  // Fetch pumps
  const { data: pumps, isLoading: pumpsLoading } = useQuery({
    queryKey: ['station-pumps', id],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Pump[] }>(`/stations/${id}/pumps`);
      // Extract array data from wrapped response
      const pumpData = extractApiArray(response, []);
      return pumpData;
    },
    enabled: !!id
  });

  // Fetch fuel prices
  const { data: prices, isLoading: pricesLoading } = useQuery({
    queryKey: ['station-prices', id],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: { current: FuelPrice[]; history: FuelPrice[] } }>(`/stations/${id}/prices`);
      // Extract nested 'current' array from wrapped response
      const currentPrices = extractApiArray((response as any).data?.current, []);
      return currentPrices;
    },
    enabled: !!id
  });

  // Fetch creditors
  const { data: creditors, isLoading: creditorsLoading } = useQuery({
    queryKey: ['station-creditors', id],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ success: boolean; data: Creditor[] }>(`/stations/${id}/creditors`);
        // Extract array data from wrapped response
        return extractApiArray(response, []);
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          typeof (error as { response?: { status?: number } }).response === 'object' &&
          (error as { response?: { status?: number } }).response?.status === 404
        ) {
          return [];
        }
        throw error;
      }
    },
    enabled: !!id
  });

  // Create pump mutation
  const createPumpMutation = useMutation({
    mutationFn: async (data: { name: string; status: string }) => {
      const response = await apiClient.post(`/stations/${id}/pumps`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
      toast({ title: 'Success', description: 'Pump created successfully', variant: 'success' });
      setIsPumpDialogOpen(false);
      setPumpForm({ pumpNumber: '', name: '', status: 'active' });
    },
    onError: (error: unknown) => {
      let message = 'Failed to create pump';
      if (error && typeof error === 'object') {
        const errObj = error as { response?: { data?: { error?: string } }; message?: string };
        if (
          errObj.response &&
          typeof errObj.response === 'object' &&
          errObj.response.data &&
          typeof errObj.response.data === 'object' &&
          'error' in errObj.response.data
        ) {
          message = errObj.response.data.error || message;
        } else if (typeof errObj.message === 'string') {
          message = errObj.message;
        }
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // Create nozzle mutation
  const createNozzleMutation = useMutation({
    mutationFn: async ({ pumpId, data }: { pumpId: string; data: { fuelType: string; initialReading: number } }) => {
      const response = await apiClient.post(`/stations/pumps/${pumpId}/nozzles`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
      toast({ title: 'Success', description: 'Nozzle created successfully', variant: 'success' });
      setIsNozzleDialogOpen(false);
      setNozzleForm({ fuelType: getDefaultFuelType(), initialReading: '' });
      setSelectedPump(null);
    },
    onError: (error: unknown) => {
      let message = 'Failed to create nozzle';
      if (error && typeof error === 'object') {
        const errObj = error as { response?: { data?: { error?: string } }; message?: string };
        if (
          errObj.response &&
          typeof errObj.response === 'object' &&
          errObj.response.data &&
          typeof errObj.response.data === 'object' &&
          'error' in errObj.response.data
        ) {
          message = errObj.response.data.error || message;
        } else if (typeof errObj.message === 'string') {
          message = errObj.message;
        }
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // Set price mutation
  const setPriceMutation = useMutation({
    mutationFn: async (data: { fuelType: string; price: string; effectiveFrom: string }) => {
      const response = await apiClient.post(`/stations/${id}/prices`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-prices', id] });
      toast({ title: 'Success', description: 'Price updated successfully', variant: 'success' });
      setIsPriceDialogOpen(false);
      setPriceForm({ fuelType: FuelTypeEnum.PETROL, price: '', effectiveFrom: formatDateISO(new Date()) });
    },
    onError: (error: unknown) => {
      let message = 'Failed to update price';
      if (error && typeof error === 'object') {
        const errObj = error as { response?: { data?: { error?: string } }; message?: string };
        if (
          errObj.response &&
          typeof errObj.response === 'object' &&
          errObj.response.data &&
          typeof errObj.response.data === 'object' &&
          'error' in errObj.response.data
        ) {
          message = errObj.response.data.error || message;
        } else if (typeof errObj.message === 'string') {
          message = errObj.message;
        }
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // Create creditor mutation
  const createCreditorMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string; email: string; creditLimit: string; vehicleNumber: string }) => {
      const response = await apiClient.post(`/stations/${id}/creditors`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-creditors', id] });
      toast({ title: 'Success', description: 'Creditor created successfully', variant: 'success' });
      setIsCreditorDialogOpen(false);
      setCreditorForm({ name: '', phone: '', email: '', creditLimit: '', vehicleNumber: '' });
    },
    onError: (error: unknown) => {
      let message = 'Failed to create creditor';
      if (error && typeof error === 'object') {
        const errObj = error as { response?: { data?: { error?: string } }; message?: string };
        if (
          errObj.response &&
          typeof errObj.response === 'object' &&
          errObj.response.data &&
          typeof errObj.response.data === 'object' &&
          'error' in errObj.response.data
        ) {
          message = errObj.response.data.error || message;
        } else if (typeof errObj.message === 'string') {
          message = errObj.message;
        }
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // Update pump mutation
  const updatePumpMutation = useMutation({
    mutationFn: async ({ pumpId, data }: { pumpId: string; data: { name: string; status: string; notes?: string } }) => {
      const response = await apiClient.put(`/stations/pumps/${pumpId}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
      toast({ title: 'Success', description: 'Pump updated successfully', variant: 'success' });
      setIsEditPumpDialogOpen(false);
      setSelectedPump(null);
    },
    onError: (error: unknown) => {
      let message = 'Failed to update pump';
      if (error && typeof error === 'object') {
        const errObj = error as { response?: { data?: { error?: string } }; message?: string };
        if (
          errObj.response &&
          typeof errObj.response === 'object' &&
          errObj.response.data &&
          typeof errObj.response.data === 'object' &&
          'error' in errObj.response.data
        ) {
          message = errObj.response.data.error || message;
        } else if (typeof errObj.message === 'string') {
          message = errObj.message;
        }
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // Update nozzle mutation
  const updateNozzleMutation = useMutation({
    mutationFn: async ({ nozzleId, data }: { nozzleId: string; data: { status: string } }) => {
      const response = await apiClient.put(`/stations/nozzles/${nozzleId}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
      toast({ title: 'Success', description: 'Nozzle updated successfully', variant: 'success' });
      setIsEditNozzleDialogOpen(false);
      setSelectedNozzle(null);
    },
    onError: (error: unknown) => {
      let message = 'Failed to update nozzle';
      if (error && typeof error === 'object') {
        const errObj = error as { response?: { data?: { error?: string } }; message?: string };
        if (
          errObj.response &&
          typeof errObj.response === 'object' &&
          errObj.response.data &&
          typeof errObj.response.data === 'object' &&
          'error' in errObj.response.data
        ) {
          message = errObj.response.data.error || message;
        } else if (typeof errObj.message === 'string') {
          message = errObj.message;
        }
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });


  const handleCreatePump = () => {
    if (!pumpForm.name) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in pump name',
        variant: 'destructive'
      });
      return;
    }

    // Backend auto-generates pump number
    createPumpMutation.mutate({
      name: pumpForm.name,
      status: pumpForm.status
    });
  };

  const handleCreateNozzle = () => {
    if (!selectedPump) return;

    // Backend auto-generates nozzle number
    createNozzleMutation.mutate({
      pumpId: selectedPump.id,
      data: {
        fuelType: nozzleForm.fuelType,
        initialReading: parseFloat(nozzleForm.initialReading)
      }
    });
  };

  const handleSetPrice = () => {
    setPriceMutation.mutate({
      fuelType: priceForm.fuelType,
      price: priceForm.price,
      effectiveFrom: priceForm.effectiveFrom
    });
  };

  const handleCreateCreditor = () => {
    createCreditorMutation.mutate({
      name: creditorForm.name,
      phone: creditorForm.phone,
      email: creditorForm.email || '',
      creditLimit: creditorForm.creditLimit,
      vehicleNumber: creditorForm.vehicleNumber || ''
    });
  };

  const handleEditPump = (pump: Pump) => {
    setSelectedPump(pump);
    setEditPumpForm({
      name: pump.name,
      status: (pump.status === 'offline' ? EquipmentStatusEnum.INACTIVE : pump.status as EquipmentStatus),
      notes: pump.notes || ''
    });
    setIsEditPumpDialogOpen(true);
  };

  const handleUpdatePump = () => {
    if (!selectedPump) return;
    updatePumpMutation.mutate({
      pumpId: selectedPump.id,
      data: editPumpForm
    });
  };

  const handleEditNozzle = (nozzle: Nozzle) => {
    setSelectedNozzle(nozzle);
    setEditNozzleForm({
      status: (nozzle.status === 'offline' ? EquipmentStatusEnum.INACTIVE : nozzle.status as EquipmentStatus),
      notes: ''
    });
    setIsEditNozzleDialogOpen(true);
  };

  const handleUpdateNozzle = () => {
    if (!selectedNozzle) return;
    updateNozzleMutation.mutate({
      nozzleId: selectedNozzle.id,
      data: editNozzleForm
    });
  };

  

  if (stationLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Loading station details...</div>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Station not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/owner/stations')} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-bold truncate">{station.name}</h1>
            <p className="text-muted-foreground text-sm md:text-base">
              {station.code && `Code: ${station.code} • `}
              {station.city && `${station.city}, ${station.state}`}
            </p>
          </div>
        </div>
        <Badge variant={station.isActive ? 'default' : 'secondary'} className="self-start sm:self-center flex-shrink-0">
          {station.isActive ? '● Active' : '○ Inactive'} ({station.isActive ? 'true' : 'false'})
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pumps" className="space-y-4">
        <div className="flex flex-col gap-4">
          <TabsList className="flex h-14 items-center justify-center rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-1 text-muted-foreground shadow-lg border border-slate-200 dark:border-slate-700 w-full overflow-x-auto overflow-y-hidden flex-nowrap min-w-max backdrop-blur-sm">
            <TabsTrigger value="pumps" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-3 text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-blue-200 dark:data-[state=active]:border-blue-800 hover:bg-white/80 dark:hover:bg-slate-700/50 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-md flex-shrink-0 group">
              <Fuel className="w-4 h-4 mr-2 text-slate-500 group-data-[state=active]:text-blue-500 transition-colors flex-shrink-0" />
              <span className="hidden sm:inline">Pumps</span>
              <span className="sm:hidden">Pumps</span>
            </TabsTrigger>
            <TabsTrigger value="prices" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-3 text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-green-200 dark:data-[state=active]:border-green-800 hover:bg-white/80 dark:hover:bg-slate-700/50 hover:text-green-600 dark:hover:text-green-400 hover:shadow-md flex-shrink-0 group">
              <IndianRupee className="w-4 h-4 mr-2 text-slate-500 group-data-[state=active]:text-green-500 transition-colors flex-shrink-0" />
              <span className="hidden sm:inline">Prices</span>
              <span className="sm:hidden">Prices</span>
            </TabsTrigger>
            <TabsTrigger value="creditors" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-3 text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-800 hover:bg-white/80 dark:hover:bg-slate-700/50 hover:text-purple-600 dark:hover:text-purple-400 hover:shadow-md flex-shrink-0 group">
              <CreditCard className="w-4 h-4 mr-2 text-slate-500 group-data-[state=active]:text-purple-500 transition-colors flex-shrink-0" />
              <span className="hidden sm:inline">Creditors</span>
              <span className="sm:hidden">Creditors</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-3 text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-orange-200 dark:data-[state=active]:border-orange-800 hover:bg-white/80 dark:hover:bg-slate-700/50 hover:text-orange-600 dark:hover:text-orange-400 hover:shadow-md flex-shrink-0 group">
              <Settings className="w-4 h-4 mr-2 text-slate-500 group-data-[state=active]:text-orange-500 transition-colors flex-shrink-0" />
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">Settings</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Pumps & Nozzles Tab */}
        <TabsContent value="pumps" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Pumps & Nozzles</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
                }}
              >
                Refresh
              </Button>
              <Dialog open={isPumpDialogOpen} onOpenChange={(open) => {
              setIsPumpDialogOpen(open);
              // Reset form when dialog opens
              if (open) {
                setPumpForm({
                  pumpNumber: '',
                  name: '',
                  status: 'active'
                });
              }
            }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Pump
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Pump</DialogTitle>
                  <DialogDescription>Create a new pump for this station</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="pumpName">Pump Name *</Label>
                    <Input
                      id="pumpName"
                      value={pumpForm.name}
                      onChange={(e) => setPumpForm({ ...pumpForm, name: e.target.value })}
                      placeholder="e.g., Main Pump"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pumpStatus">Status</Label>
                    <Select
                      value={pumpForm.status}
                      onValueChange={(value) => setPumpForm({ ...pumpForm, status: value as EquipmentStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EquipmentStatusEnum.ACTIVE}>Active</SelectItem>
                        <SelectItem value={EquipmentStatusEnum.INACTIVE}>Inactive</SelectItem>
                        <SelectItem value={EquipmentStatusEnum.MAINTENANCE}>Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsPumpDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreatePump}
                    disabled={!pumpForm.name || createPumpMutation.isPending}
                  >
                    {createPumpMutation.isPending ? 'Creating...' : 'Create Pump'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {pumpsLoading ? (
            <div className="text-center py-6">Loading pumps...</div>
          ) : !pumps || !Array.isArray(pumps) || pumps.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Fuel className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No pumps added yet</p>

                <Button onClick={() => setIsPumpDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Pump
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-green-600 mb-2">
                ✅ Found {pumps.length} pumps
              </div>
              {pumps.map((pump) => (
                <Card key={pump.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Fuel className="w-5 h-5 text-primary" />
                          Pump {pump.pumpNumber}
                        </CardTitle>
                        <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                          <div>{pump.name}</div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1">
                              <span className="font-medium">{pump.nozzles?.length || 0}</span> nozzles
                            </span>
                            {pump.nozzles && pump.nozzles.length > 0 && (
                              <span className="flex items-center gap-1">
                                Fuels: {[...new Set(pump.nozzles.map((n: any) => n.fuelType))].join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge variant={pump.status === EquipmentStatusEnum.ACTIVE ? 'default' : 'secondary'}>
                          {pump.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditPump(pump)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Pump Metrics */}
                    <div className="grid grid-cols-2 gap-3 p-2 bg-muted/30 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {pump.nozzles?.filter((n: any) => n.status === EquipmentStatusEnum.ACTIVE).length || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Active Nozzles</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {safeToFixed(
                            (pump.nozzles && Array.isArray(pump.nozzles))
                              ? pump.nozzles.reduce((total: number, n: any) => {
                                  const lastReading = n.lastReading != null ? n.lastReading : n.initialReading;
                                  return total + (lastReading || 0);
                                }, 0)
                              : 0,
                            1
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">Total Reading</div>
                      </div>
                    </div>

                    {/* Nozzles Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-muted-foreground">
                          Nozzles ({pump.nozzles?.length || 0})
                        </h4>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPump(pump);
                            setIsNozzleDialogOpen(true);
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      </div>

                      {pump.nozzles && pump.nozzles.length > 0 ? (
                        <div className="space-y-1.5">
                          {pump.nozzles.map((nozzle: any) => (
                            <div
                              key={nozzle.id}
                              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm">N{nozzle.nozzleNumber}</span>
                                  <Badge
                                    className={`${getFuelBadgeClasses(nozzle.fuelType)} text-xs px-2 py-0.5`}
                                  >
                                    {nozzle.fuelType}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  Last: {nozzle.lastReading != null ? toFixedNumber(nozzle.lastReading, 2) : toFixedNumber(nozzle.initialReading, 2)}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 ml-2">
                                <Badge
                                  variant={nozzle.status === EquipmentStatusEnum.ACTIVE ? 'outline' : 'secondary'}
                                  className="text-xs px-2 py-0.5"
                                >
                                  {nozzle.status}
                                </Badge>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditNozzle(nozzle)}
                                    className="h-7 w-7 p-0 hover:bg-primary/10"
                                    title="Edit Nozzle"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                          <Fuel className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                          <p className="text-sm text-muted-foreground mb-3">No nozzles configured</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPump(pump);
                              setIsNozzleDialogOpen(true);
                            }}
                            className="text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add First Nozzle
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Fuel Prices Tab */}
        <TabsContent value="prices" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Fuel Prices</h2>
            <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <IndianRupee className="w-4 h-4 mr-2" />
                  Set Price
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Fuel Price</DialogTitle>
                  <DialogDescription>Update price for a fuel type</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="fuelType">Fuel Type *</Label>
                    <Select
                      value={priceForm.fuelType}
                      onValueChange={(value) => setPriceForm({ ...priceForm, fuelType: value as FuelType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={FuelTypeEnum.PETROL}>Petrol</SelectItem>
                        <SelectItem value={FuelTypeEnum.DIESEL}>Diesel</SelectItem>
                        <SelectItem value={FuelTypeEnum.CNG}>CNG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="price">Price (₹/L) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={priceForm.price}
                      onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })}
                      placeholder="105.50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="effectiveFrom">Effective From *</Label>
                    <Input
                      id="effectiveFrom"
                      type="date"
                      value={priceForm.effectiveFrom}
                      onChange={(e) => setPriceForm({ ...priceForm, effectiveFrom: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsPriceDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSetPrice}
                    disabled={!priceForm.price || setPriceMutation.isPending}
                  >
                    {setPriceMutation.isPending ? 'Setting...' : 'Set Price'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {pricesLoading ? (
            <div className="text-center py-6">Loading prices...</div>
          ) : prices && prices.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {prices.map((price: any) => (
                <Card key={price.id}>
                  <CardHeader>
                    <CardTitle className="text-lg capitalize">{price.fuelType}</CardTitle>
                    <CardDescription>
                      Effective from {formatDateLocal(price.effectiveFrom)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">₹{toFixedNumber(price.price, 2)}</div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Updated {formatDateTimeLocal(price.createdAt)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <IndianRupee className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No fuel prices set</p>
                <Button onClick={() => setIsPriceDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Set First Price
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Creditors Tab */}
        <TabsContent value="creditors" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Credit Customers</h2>
            <Dialog open={isCreditorDialogOpen} onOpenChange={setIsCreditorDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Creditor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Creditor</DialogTitle>
                  <DialogDescription>Create a new credit customer for this station</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="creditorName">Name *</Label>
                    <Input
                      id="creditorName"
                      value={creditorForm.name}
                      onChange={(e) => debouncedSetCreditorName(e.target.value)}
                      placeholder="Customer name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="creditorPhone">Phone *</Label>
                    <Input
                      id="creditorPhone"
                      value={creditorForm.phone}
                      onChange={e => debouncedSetCreditorPhone(e.target.value)}
                      placeholder="+91-9876543210"
                    />
                  </div>
                  <div>
                    <Label htmlFor="creditorEmail">Email</Label>
                    <Input
                      id="creditorEmail"
                      type="email"
                      value={creditorForm.email}
                      onChange={e => debouncedSetCreditorEmail(e.target.value)}
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="creditLimit">Credit Limit *</Label>
                    <Input
                      id="creditLimit"
                      type="number"
                      step="0.01"
                      value={creditorForm.creditLimit}
                      onChange={(e) => setCreditorForm({ ...creditorForm, creditLimit: e.target.value })}
                      placeholder="10000.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vehicleNumber">Vehicle Number</Label>
                    <Input
                      id="vehicleNumber"
                      value={creditorForm.vehicleNumber}
                      onChange={e => debouncedSetCreditorVehicle(e.target.value)}
                      placeholder="MH-12-AB-1234"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreditorDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateCreditor}
                    disabled={!creditorForm.name || !creditorForm.phone || !creditorForm.creditLimit || createCreditorMutation.isPending}
                  >
                    {createCreditorMutation.isPending ? 'Creating...' : 'Create Creditor'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {creditorsLoading ? (
            <div className="text-center py-6">Loading creditors...</div>
          ) : creditors && creditors.length > 0 ? (
            <div className="grid gap-4">
              {creditors.map((creditor) => (
                <Card key={creditor.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {creditor.name}
                        </CardTitle>
                        <CardDescription>
                          {creditor.phone} {creditor.vehicleNumber && `• ${creditor.vehicleNumber}`}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Credit Limit</p>
                        <p className="text-lg font-semibold">₹{toFixedNumber(creditor.creditLimit, 2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Current Balance</p>
                        <p className={`text-lg font-semibold ${creditor.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ₹{toFixedNumber(creditor.currentBalance, 2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Available Credit</p>
                        <p className="text-lg font-semibold">
                          ₹{toFixedNumber(creditor.creditLimit - creditor.currentBalance, 2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Utilization</p>
                        <p className="text-lg font-semibold">
                          {toFixedNumber((creditor.currentBalance / creditor.creditLimit) * 100, 1)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No creditors added yet</p>
                <Button onClick={() => setIsCreditorDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Creditor
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <h2 className="text-xl font-semibold">Station Settings</h2>
          {id && <StationSettingsForm stationId={id} />}
        </TabsContent>
      </Tabs>

      {/* Add Nozzle Dialog */}
      <Dialog open={isNozzleDialogOpen} onOpenChange={(open) => {
        setIsNozzleDialogOpen(open);
        // Reset form when dialog opens
        if (open) {
          setNozzleForm({
            fuelType: getDefaultFuelType(),
            initialReading: ''
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Nozzle</DialogTitle>
            <DialogDescription>
              Add a new nozzle to {selectedPump?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nozzleFuelType">Fuel Type *</Label>
              <Select
                value={nozzleForm.fuelType}
                onValueChange={(value) => setNozzleForm({ ...nozzleForm, fuelType: value as FuelType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FuelTypeEnum.PETROL}>Petrol</SelectItem>
                  <SelectItem value={FuelTypeEnum.DIESEL}>Diesel</SelectItem>
                  <SelectItem value={FuelTypeEnum.CNG}>CNG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="initialReading">Initial Reading *</Label>
              <Input
                id="initialReading"
                type="number"
                step="0.01"
                value={nozzleForm.initialReading}
                onChange={(e) => setNozzleForm({ ...nozzleForm, initialReading: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsNozzleDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateNozzle}
              disabled={!nozzleForm.initialReading || createNozzleMutation.isPending}
            >
              {createNozzleMutation.isPending ? 'Creating...' : 'Create Nozzle'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Pump Dialog */}
      <Dialog open={isEditPumpDialogOpen} onOpenChange={setIsEditPumpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pump</DialogTitle>
            <DialogDescription>
              Update pump details for {selectedPump?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editPumpName">Pump Name *</Label>
              <Input
                id="editPumpName"
                value={editPumpForm.name}
                onChange={(e) => setEditPumpForm({ ...editPumpForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="editPumpStatus">Status</Label>
              <Select
                value={editPumpForm.status}
                onValueChange={(value) => setEditPumpForm({ ...editPumpForm, status: value as EquipmentStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EquipmentStatusEnum.ACTIVE}>Active</SelectItem>
                  <SelectItem value={EquipmentStatusEnum.INACTIVE}>Inactive</SelectItem>
                  <SelectItem value={EquipmentStatusEnum.MAINTENANCE}>Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editPumpNotes">Notes</Label>
              <Input
                id="editPumpNotes"
                value={editPumpForm.notes}
                onChange={(e) => setEditPumpForm({ ...editPumpForm, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditPumpDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdatePump}
              disabled={!editPumpForm.name || updatePumpMutation.isPending}
            >
              {updatePumpMutation.isPending ? 'Updating...' : 'Update Pump'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Nozzle Dialog */}
      <Dialog open={isEditNozzleDialogOpen} onOpenChange={setIsEditNozzleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Nozzle</DialogTitle>
            <DialogDescription>
              Update nozzle status for Nozzle {selectedNozzle?.nozzleNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editNozzleStatus">Status</Label>
              <Select
                value={editNozzleForm.status}
                onValueChange={(value) => setEditNozzleForm({ ...editNozzleForm, status: value as EquipmentStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EquipmentStatusEnum.ACTIVE}>Active</SelectItem>
                  <SelectItem value={EquipmentStatusEnum.INACTIVE}>Inactive</SelectItem>
                  <SelectItem value={EquipmentStatusEnum.MAINTENANCE}>Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editNozzleNotes">Notes</Label>
              <Input
                id="editNozzleNotes"
                value={editNozzleForm.notes}
                onChange={(e) => setEditNozzleForm({ ...editNozzleForm, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditNozzleDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateNozzle}
              disabled={updateNozzleMutation.isPending}
            >
              {updateNozzleMutation.isPending ? 'Updating...' : 'Update Nozzle'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      
    </div>
  );
}
