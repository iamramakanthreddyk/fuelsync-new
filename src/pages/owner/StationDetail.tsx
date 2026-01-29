/**
 * Station Detail Page
 * Comprehensive view of a single station with pumps, nozzles, fuel prices
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toFixedNumber } from '@/lib/numberFormat';
import { formatDateISO, formatDateLocal, formatDateTimeLocal } from '@/lib/dateFormat';
import { Button } from '@/components/ui/button';
import InlineSettleForm from '../credit/InlineSettleForm';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FuelTypeSelect } from '@/components/FuelTypeSelect';
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
import { getFuelBadgeClasses, getFuelColors } from '@/lib/fuelColors';
import { FUEL_TYPE_LABELS } from '@/lib/constants';
import { Station } from '@/types/api';
import { StationSettingsForm } from '@/components/owner/StationSettingsForm';
import {
  ArrowLeft,
  Plus,
  Edit,
  Fuel,
  Settings,
  IndianRupee,
  CreditCard,
  CheckCircle2,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { useFuelPricesData } from '@/hooks/useFuelPricesData';

// Import enums and types
import type {
  FuelType,
  EquipmentStatus
} from '@/core/enums';
import { FuelTypeEnum, EquipmentStatusEnum } from '@/core/enums';

// Define reading payment types (subset of PaymentMethod used for readings)

// Inline no-op references to avoid unused-variable compile errors
/* istanbul ignore next */
void useEffect;

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
  // Track which creditor's settle form is open
  const [settleOpenId, setSettleOpenId] = useState<string | null>(null);
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
  const [activeTab, setActiveTab] = useState<string>('pumps');

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
    costPrice: '',
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

  // reference dialog state and debounced handlers in a no-op way to quiet unused warnings
  /* istanbul ignore next */
  void isCreditorDialogOpen;
  void debouncedSetCreditorName;
  void debouncedSetCreditorPhone;
  void debouncedSetCreditorEmail;
  void debouncedSetCreditorVehicle;

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
    mutationFn: async (data: { fuelType: string; price: string; costPrice?: string; effectiveFrom: string }) => {
      const response = await apiClient.post(`/stations/${id}/prices`, data);
      return response;
    },
    onSuccess: () => {
      // Invalidate both direct and global fuel price queries
      queryClient.invalidateQueries({ queryKey: ['fuel-prices', id] });
      queryClient.invalidateQueries({ queryKey: ['all-fuel-prices'] });
      toast({ title: 'Success', description: 'Price updated successfully', variant: 'success' });
      setIsPriceDialogOpen(false);
      setPriceForm({ fuelType: FuelTypeEnum.PETROL, price: '', costPrice: '', effectiveFrom: formatDateISO(new Date()) });
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
    // Validate cost price if provided
    if (priceForm.costPrice) {
      const costPrice = parseFloat(priceForm.costPrice);
      const price = parseFloat(priceForm.price);
      if (costPrice >= price) {
        toast({
          title: 'Invalid Cost Price',
          description: 'Cost price must be less than selling price',
          variant: 'destructive'
        });
        return;
      }
    }
    
    setPriceMutation.mutate({
      fuelType: priceForm.fuelType,
      price: priceForm.price,
      costPrice: priceForm.costPrice || undefined,
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

  // no-op reference to avoid 'declared but never used' TS warning when the handler is wired elsewhere
  void handleCreateCreditor;

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

  // Fetch fuel prices using the custom hook - MUST be called before ANY early returns
  const { data: fuelPrices, isLoading: fuelPricesLoading } = useFuelPricesData(id);

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
    <div className="container mx-auto p-6 space-y-4 page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/owner/stations')}
            className="flex-shrink-0 hover:bg-primary hover:text-primary-foreground transition-colors duration-200 px-3 py-2 h-auto"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col gap-4">
          {/* Quick Actions Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-amber-600" />
              <span className="font-medium text-amber-900 dark:text-amber-100">Fuel Pricing</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab('prices')}
              className="text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            >
              Manage Prices →
            </Button>
          </div>
          <TabsList className="flex h-14 items-center justify-center rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-1 text-muted-foreground shadow-lg border border-slate-200 dark:border-slate-700 w-full overflow-x-auto overflow-y-hidden flex-nowrap min-w-max backdrop-blur-sm">
            <TabsTrigger value="pumps" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 sm:px-4 py-3 text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-blue-200 dark:data-[state=active]:border-blue-800 hover:bg-white/80 dark:hover:bg-slate-700/50 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-md flex-shrink-0 group">
              <Fuel className="w-5 h-5 sm:w-6 sm:h-6 sm:mr-2 text-blue-500 group-data-[state=active]:text-blue-600 group-hover:text-blue-600 transition-colors flex-shrink-0" />
              <span className="hidden sm:inline">Pumps</span>
            </TabsTrigger>
            <TabsTrigger value="prices" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 sm:px-4 py-3 text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-green-200 dark:data-[state=active]:border-green-800 hover:bg-white/80 dark:hover:bg-slate-700/50 hover:text-green-600 dark:hover:text-green-400 hover:shadow-md flex-shrink-0 group">
              <IndianRupee className="w-5 h-5 sm:w-6 sm:h-6 sm:mr-2 text-green-500 group-data-[state=active]:text-green-600 group-hover:text-green-600 transition-colors flex-shrink-0" />
              <span className="hidden sm:inline">Prices</span>
            </TabsTrigger>
            <TabsTrigger value="creditors" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 sm:px-4 py-3 text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-800 hover:bg-white/80 dark:hover:bg-slate-700/50 hover:text-purple-600 dark:hover:text-purple-400 hover:shadow-md flex-shrink-0 group">
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 sm:mr-2 text-purple-500 group-data-[state=active]:text-purple-600 group-hover:text-purple-600 transition-colors flex-shrink-0" />
              <span className="hidden sm:inline">Creditors</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 sm:px-4 py-3 text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-orange-200 dark:data-[state=active]:border-orange-800 hover:bg-white/80 dark:hover:bg-slate-700/50 hover:text-orange-600 dark:hover:text-orange-400 hover:shadow-md flex-shrink-0 group">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6 sm:mr-2 text-orange-500 group-data-[state=active]:text-orange-600 group-hover:text-orange-600 transition-colors flex-shrink-0" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Pumps & Nozzles Tab */}
        <TabsContent value="pumps" className="space-y-4 sm:space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex flex-col gap-2 text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-bold">Pumps & Nozzles</h2>
                <p className="text-sm sm:text-base text-muted-foreground">Manage fuel pumps and their nozzles</p>
              </div>
              <div className="flex gap-2 flex-shrink-0 justify-center sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
                  }}
                  size="sm"
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Dialog open={isPumpDialogOpen} onOpenChange={(open) => {
                setIsPumpDialogOpen(open);
                // Reset form when dialog opens
                if (open) {
                  setPumpForm({
                    pumpNumber: '',
                    name: '',
                    status: EquipmentStatusEnum.ACTIVE
                  });
                }
              }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full">
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

            {/* Summary Cards */}
            <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between gap-4 sm:gap-6">
                  {/* Total Pumps */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-1">
                    <div className="p-1.5 bg-blue-500 rounded-lg flex-shrink-0">
                      <Fuel className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-bold text-blue-600">{pumps?.length || 0}</div>
                      <div className="text-xs text-muted-foreground">Total Pumps</div>
                    </div>
                  </div>

                  {/* Active Pumps */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-1">
                    <div className="p-1.5 bg-green-500 rounded-lg flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-bold text-green-600">
                        {pumps?.filter(p => p.status === EquipmentStatusEnum.ACTIVE).length || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Active Pumps</div>
                    </div>
                  </div>

                  {/* Total Nozzles */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-1">
                    <div className="p-1.5 bg-purple-500 rounded-lg flex-shrink-0">
                      <Settings className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-bold text-purple-600">
                        {pumps?.reduce((total, pump) => total + (pump.nozzles?.length || 0), 0) || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Nozzles</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          {pumpsLoading ? (
            <div className="flex items-center justify-center py-8 sm:py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-sm sm:text-base text-muted-foreground">Loading pumps...</p>
              </div>
            </div>
          ) : !pumps || !Array.isArray(pumps) || pumps.length === 0 ? (
            <Card className="border-2 border-dashed border-muted-foreground/25">
              <CardContent className="py-8 sm:py-12 text-center">
                <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                  <Fuel className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">No Pumps Configured</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-sm mx-auto">
                  Set up fuel pumps to start managing your station's fuel dispensing equipment.
                </p>
                <Button onClick={() => setIsPumpDialogOpen(true)} className="touch-manipulation">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Pump
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Pumps List */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{pumps.length}</span> pumps configured
                </div>

                {pumps.map((pump) => {
                  const isActive = pump.status === EquipmentStatusEnum.ACTIVE;
                  const isMaintenance = pump.status === EquipmentStatusEnum.MAINTENANCE;
                  const activeNozzles = pump.nozzles?.filter((n: any) => n.status === EquipmentStatusEnum.ACTIVE).length || 0;
                  const totalNozzles = pump.nozzles?.length || 0;
                  const fuelTypes = [...new Set(pump.nozzles?.map((n: any) => n.fuelType) || [])] as string[];

                  return (
                    <Card
                      key={pump.id}
                      className={`relative overflow-hidden border transition-all duration-300 hover:shadow-md ${
                        isActive
                          ? 'border-green-200 bg-green-50/20'
                          : isMaintenance
                          ? 'border-orange-200 bg-orange-50/20'
                          : 'border-gray-200 bg-gray-50/20'
                      }`}
                    >
                      {/* Status indicator stripe */}
                      <div className={`absolute top-0 left-0 right-0 h-0.5 ${
                        isActive ? 'bg-green-500' : isMaintenance ? 'bg-orange-500' : 'bg-gray-500'
                      }`}></div>

                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          {/* Left side - Pump info */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`p-1.5 rounded-md flex-shrink-0 ${
                              isActive ? 'bg-green-100 text-green-700' :
                              isMaintenance ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              <Fuel className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-sm">Pump {pump.pumpNumber}</h3>
                                <Badge
                                  variant={isActive ? 'default' : isMaintenance ? 'secondary' : 'outline'}
                                  className={`text-xs px-1.5 py-0.5 ${
                                    isActive ? 'bg-green-100 text-green-800 border-green-300' :
                                    isMaintenance ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                    'bg-gray-100 text-gray-800 border-gray-300'
                                  }`}
                                >
                                  {pump.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{pump.name}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span>{totalNozzles} nozzles</span>
                                <span className="text-green-600">{activeNozzles} active</span>
                                {fuelTypes.length > 0 && (
                                  <span>{fuelTypes.length} fuel{fuelTypes.length > 1 ? 's' : ''}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right side - Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditPump(pump)}
                              className="h-7 w-7 p-0 hover:bg-primary/10"
                              title="Edit Pump"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPump(pump);
                                setIsNozzleDialogOpen(true);
                              }}
                              className="h-7 px-2 text-xs"
                              title="Add Nozzle"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add
                            </Button>
                          </div>
                        </div>

                        {/* Fuel Types - Compact inline */}
                        {fuelTypes.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
                            <span className="text-xs font-medium text-muted-foreground">Fuel:</span>
                            <div className="flex gap-1">
                              {fuelTypes.map((fuelType) => {
                                const fuelColors = getFuelColors(fuelType);
                                return (
                                  <Badge
                                    key={fuelType}
                                    className={`${fuelColors.bg} ${fuelColors.text} ${fuelColors.border} text-xs px-1.5 py-0.5`}
                                  >
                                    {fuelType}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Nozzles - Compact list */}
                        {pump.nozzles && pump.nozzles.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-muted-foreground">Nozzles</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {pump.nozzles.map((nozzle: any) => {
                                const fuelColors = getFuelColors(nozzle.fuelType);
                                const isNozzleActive = nozzle.status === EquipmentStatusEnum.ACTIVE;

                                return (
                                  <div
                                    key={nozzle.id}
                                    className={`flex items-center gap-2 p-2 rounded border text-xs transition-colors ${
                                      isNozzleActive
                                        ? 'bg-white border-green-200 hover:bg-green-50/50'
                                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100/50'
                                    }`}
                                  >
                                    <div className={`p-0.5 rounded ${fuelColors.bg} ${fuelColors.text} flex-shrink-0`}>
                                      <Fuel className="w-2.5 h-2.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="font-medium">N{nozzle.nozzleNumber}</span>
                                        <Badge className={`${fuelColors.bg} ${fuelColors.text} ${fuelColors.border} text-xs px-1 py-0`}>
                                          {FUEL_TYPE_LABELS[nozzle.fuelType as keyof typeof FUEL_TYPE_LABELS] || nozzle.fuelType}
                                        </Badge>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {nozzle.lastReading != null ? toFixedNumber(nozzle.lastReading, 2) : toFixedNumber(nozzle.initialReading, 2)}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Badge
                                        variant={isNozzleActive ? 'outline' : 'secondary'}
                                        className={`text-xs px-1 py-0 ${
                                          isNozzleActive ? 'border-green-300 text-green-700' : ''
                                        }`}
                                      >
                                        {nozzle.status}
                                      </Badge>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEditNozzle(nozzle)}
                                        className="h-5 w-5 p-0 hover:bg-primary/10"
                                        title="Edit Nozzle"
                                      >
                                        <Edit className="w-2.5 h-2.5" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
          </div>
        </TabsContent>

        {/* Fuel Prices Tab */}
        <TabsContent value="prices" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Fuel Prices</h2>
              <p className="text-muted-foreground">Current pricing for all fuel types</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['fuel-prices', id] });
                  queryClient.invalidateQueries({ queryKey: ['all-fuel-prices'] });
                }}
                size="sm"
              >
                Refresh
              </Button>
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
                      <FuelTypeSelect
                        value={priceForm.fuelType}
                        onValueChange={(value) => setPriceForm({ ...priceForm, fuelType: value as FuelType })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="price">Selling Price (₹/L) *</Label>
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
                      <Label htmlFor="costPrice">Purchase Price (₹/L)</Label>
                      <Input
                        id="costPrice"
                        type="number"
                        step="0.01"
                        value={priceForm.costPrice}
                        onChange={(e) => setPriceForm({ ...priceForm, costPrice: e.target.value })}
                        placeholder="95.50 (optional)"
                      />
                      {priceForm.price && priceForm.costPrice && (
                        <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                          <p className="text-xs text-green-700 font-semibold">
                            ✓ Profit: ₹{(parseFloat(priceForm.price) - parseFloat(priceForm.costPrice)).toFixed(2)}/L
                          </p>
                          <p className="text-xs text-green-600">
                            Margin: {(((parseFloat(priceForm.price) - parseFloat(priceForm.costPrice)) / parseFloat(priceForm.price)) * 100).toFixed(2)}%
                          </p>
                        </div>
                      )}
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
          </div>

          {fuelPricesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading fuel prices...</p>
              </div>
            </div>
          ) : fuelPrices && fuelPrices.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {fuelPrices.map((price) => {
                const fuelColors = getFuelColors(String(price.fuelType || '').toLowerCase());
                const isEffectiveToday = new Date(price.effectiveFrom) <= new Date();

                return (
                  <Card
                    key={price.id}
                    className={`relative overflow-hidden border-2 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${fuelColors.border} ${fuelColors.bg}/20`}
                  >
                    {/* Fuel type indicator stripe */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${fuelColors.dot}`}></div>

                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${fuelColors.bg} ${fuelColors.text}`}>
                            <Fuel className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className={`text-xl font-bold capitalize ${fuelColors.text}`}>
                              {price.fuelType}
                            </CardTitle>
                            <CardDescription className="text-sm">
                              {isEffectiveToday ? 'Currently Active' : 'Scheduled'}
                            </CardDescription>
                          </div>
                        </div>
                        {!isEffectiveToday && (
                          <Badge variant="outline" className="text-xs">
                            Upcoming
                          </Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Price Display */}
                      <div className="text-center">
                        <div className={`text-4xl font-bold ${fuelColors.text} mb-1`}>
                          ₹{Number(price.price).toFixed(2)}
                        </div>
                        <p className="text-sm text-muted-foreground">selling price</p>
                      </div>

                      {/* Cost Price & Profit */}
                      {price.cost_price !== null && price.cost_price !== undefined && (
                        <div className="bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
                          <div className="text-sm">
                            <div className="flex justify-between mb-2">
                              <span className="text-muted-foreground">Cost Price:</span>
                              <span className="font-medium">₹{Number(price.cost_price).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t border-green-200 pt-2">
                              <span className="text-green-700 dark:text-green-300 font-semibold">Profit/L:</span>
                              <span className="text-green-700 dark:text-green-300 font-bold">
                                ₹{(Number(price.price) - Number(price.cost_price)).toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                              Margin: {(((Number(price.price) - Number(price.cost_price)) / Number(price.price)) * 100).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Effective Date */}
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Effective: {new Date(price.effectiveFrom).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>

                      {/* Status Indicator */}
                      <div className="flex items-center justify-center">
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                          isEffectiveToday
                            ? 'bg-green-100 text-green-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            isEffectiveToday ? 'bg-green-500' : 'bg-orange-500'
                          }`}></div>
                          {isEffectiveToday ? 'Active' : 'Pending'}
                        </div>
                      </div>
                    </CardContent>

                    {/* Subtle gradient overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${fuelColors.bg}/5 pointer-events-none`}></div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-2 border-dashed border-muted-foreground/25">
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                  <IndianRupee className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Fuel Prices Set</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Set prices for different fuel types to start tracking your station's pricing.
                </p>
                <Button onClick={() => setIsPriceDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Set First Price
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Price Summary */}
          {fuelPrices && fuelPrices.length > 0 && (
            <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
              <CardContent className="p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Price Summary</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {fuelPrices.length} fuel type{fuelPrices.length > 1 ? 's' : ''} configured
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-green-600">
                        ₹{Math.min(...fuelPrices.map(p => Number(p.price))).toFixed(2)}
                      </div>
                      <div className="text-muted-foreground">Lowest Price</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">
                        ₹{(fuelPrices.reduce((sum, p) => sum + Number(p.price), 0) / fuelPrices.length).toFixed(2)}
                      </div>
                      <div className="text-muted-foreground">Average Price</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-purple-600">
                        ₹{Math.max(...fuelPrices.map(p => Number(p.price))).toFixed(2)}
                      </div>
                      <div className="text-muted-foreground">Highest Price</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Creditors Tab */}
        <TabsContent value="creditors" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Credit Customers</h2>
            <Link to={`/owner/stations/${id}/add-creditor`}>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Creditor
              </Button>
            </Link>
          </div>

          {creditorsLoading ? (
            <div className="text-center py-6">Loading creditors...</div>
          ) : creditors && creditors.length > 0 && creditors.filter(c => c.currentBalance > 0).length > 0 ? (
            <div className="grid gap-4">
              {creditors.filter(c => c.currentBalance > 0).map((creditor) => (
                <Card key={creditor.id} className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg truncate">
                          <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0" />
                          <span className="truncate">{creditor.name}</span>
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs sm:text-sm truncate">
                          {creditor.phone} {creditor.vehicleNumber && `• ${creditor.vehicleNumber}`}
                        </CardDescription>
                      </div>
                      {/* Settle button prominently placed in header */}
                      {creditor.currentBalance > 0 && settleOpenId !== creditor.id && (
                        <Button
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-sm flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3"
                          onClick={() => setSettleOpenId(creditor.id)}
                        >
                          <IndianRupee className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          <span className="hidden xs:inline">Settle</span>
                          <span className="xs:hidden">Pay</span>
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
                      <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs sm:text-xs text-muted-foreground font-medium">Credit Limit</p>
                        <p className="text-base sm:text-lg font-bold text-blue-600 truncate">₹{toFixedNumber(creditor.creditLimit, 2)}</p>
                      </div>
                      <div className="text-center p-2 sm:p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-xs sm:text-xs text-muted-foreground font-medium">Outstanding</p>
                        <p className="text-base sm:text-lg font-bold text-red-600 truncate">
                          ₹{toFixedNumber(creditor.currentBalance, 2)}
                        </p>
                      </div>
                      <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg border border-green-200 col-span-1 sm:col-span-2 lg:col-span-1">
                        <p className="text-xs sm:text-xs text-muted-foreground font-medium">Available</p>
                        <p className="text-base sm:text-lg font-bold text-green-600 truncate">
                          ₹{toFixedNumber(creditor.creditLimit - creditor.currentBalance, 2)}
                        </p>
                      </div>
                    </div>
                    {/* Show Settle form when opened */}
                    {settleOpenId === creditor.id && (
                      <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <InlineSettleForm
                          stationId={id}
                          creditorId={creditor.id}
                          onSuccess={() => {
                            setSettleOpenId(null);
                            queryClient.invalidateQueries({ queryKey: ['station-creditors', id] });
                          }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : creditors && creditors.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No creditors added yet</p>
                <Link to={`/owner/stations/${id}/add-creditor`}>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Creditor
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground mb-4">All credits are settled - no outstanding balances</p>
                <Link to={`/owner/stations/${id}/add-creditor`}>
                  <Button variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Creditor
                  </Button>
                </Link>
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
              <FuelTypeSelect
                value={nozzleForm.fuelType}
                onValueChange={(value) => setNozzleForm({ ...nozzleForm, fuelType: value as FuelType })}
              />
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
