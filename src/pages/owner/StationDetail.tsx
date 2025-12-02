/**
 * Station Detail Page
 * Comprehensive view of a single station with pumps, nozzles, fuel prices
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toFixedNumber } from '@/lib/numberFormat';
import { formatDateISO, formatDateLocal, formatDateTimeLocal } from '@/lib/dateFormat';
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
import { mapReadingFormToPayload } from '@/lib/apiPayloadHelpers';
import { debounce } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { getFuelBadgeClasses } from '@/lib/fuelColors';
import {
  ArrowLeft,
  Plus,
  Edit,
  Fuel,
  Settings,
  DollarSign,
  Users,
  CreditCard
} from 'lucide-react';

interface Pump {
  id: string;
  stationId: string;
  pumpNumber: number;
  name: string;
  status: 'active' | 'inactive' | 'maintenance';
  notes?: string;
  nozzles?: Nozzle[];
}

interface Nozzle {
  id: string;
  pumpId: string;
  nozzleNumber: number;
  fuelType: string;
  status: 'active' | 'inactive' | 'maintenance';
  initialReading: number;
  lastReading?: number;
}

interface FuelPrice {
  id: string;
  fuelType: string;
  price: number;
  effectiveFrom: string;
  updatedAt: string;
}
interface Station {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  isActive: boolean;
}

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

  console.log('🚀 StationDetail COMPONENT MOUNTED - ID:', id);
  
  const [isPumpDialogOpen, setIsPumpDialogOpen] = useState(false);
  const [isNozzleDialogOpen, setIsNozzleDialogOpen] = useState(false);
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [isCreditorDialogOpen, setIsCreditorDialogOpen] = useState(false);
  const [isEditPumpDialogOpen, setIsEditPumpDialogOpen] = useState(false);
  const [isEditNozzleDialogOpen, setIsEditNozzleDialogOpen] = useState(false);
  const [isReadingDialogOpen, setIsReadingDialogOpen] = useState(false);
  const [selectedPump, setSelectedPump] = useState<Pump | null>(null);
  const [selectedNozzle, setSelectedNozzle] = useState<Nozzle | null>(null);

  const [pumpForm, setPumpForm] = useState({
    pumpNumber: '',
    name: '',
    status: 'active' as 'active' | 'inactive' | 'maintenance'
  });

  const [editPumpForm, setEditPumpForm] = useState<{
    name: string;
    status: 'active' | 'inactive' | 'maintenance';
    notes: string;
  }>({
    name: '',
    status: 'active',
    notes: ''
  });

  const [nozzleForm, setNozzleForm] = useState({
    nozzleNumber: '',
    fuelType: 'petrol',
    initialReading: ''
  });

  const [editNozzleForm, setEditNozzleForm] = useState<{
    status: 'active' | 'inactive' | 'maintenance';
    notes: string;
  }>({
    status: 'active',
    notes: ''
  });

  const [readingForm, setReadingForm] = useState({
    nozzleId: '',
    readingValue: '',
    readingDate: formatDateISO(new Date()),
    paymentType: 'cash' as 'cash' | 'digital' | 'credit'
  });

  const [priceForm, setPriceForm] = useState({
    fuelType: 'petrol',
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
      const response = await apiClient.get<Station>(`/stations/${id}`);
      console.log('Station API Response:', response);
      return response;
    },
    enabled: !!id
  });

  // Fetch pumps
  const { data: pumps, isLoading: pumpsLoading } = useQuery({
    queryKey: ['station-pumps', id],
    queryFn: async () => {
      const response = await apiClient.get<Pump[]>(`/stations/${id}/pumps`);
      console.log('=== PUMPS DEBUG ===');
      console.log('Raw API Response:', response);
      console.log('Is Array?', Array.isArray(response));
      console.log('Type:', typeof response);
      console.log('Length:', response?.length);
      if (response && response.length > 0) {
        console.log('First pump:', response[0]);
      }
      return response;
    },
    enabled: !!id
  });

  // Log pumps state changes
  console.log('=== PUMPS STATE ===');
  console.log('Pumps:', pumps);
  console.log('Loading:', pumpsLoading);
  console.log('Pumps is array?', Array.isArray(pumps));

  // Debug effect to track pumps changes
  useEffect(() => {
    console.log('🔍 PUMPS CHANGED:', {
      pumps,
      isArray: Array.isArray(pumps),
      length: pumps?.length,
      loading: pumpsLoading
    });
  }, [pumps, pumpsLoading]);

  // Fetch fuel prices
  const { data: prices, isLoading: pricesLoading } = useQuery({
    queryKey: ['station-prices', id],
    queryFn: async () => {
      const response = await apiClient.get<FuelPrice[]>(`/stations/${id}/prices`);
      return response;
    },
    enabled: !!id
  });

  // Fetch creditors
  const { data: creditors, isLoading: creditorsLoading } = useQuery({
    queryKey: ['station-creditors', id],
    queryFn: async () => {
      try {
        const response = await apiClient.get<Creditor[]>(`/credits/stations/${id}/creditors`);
        return response;
      } catch (error: any) {
        if (error?.response?.status === 404) {
          return [];
        }
        throw error;
      }
    },
    enabled: !!id
  });

  // Create pump mutation
  const createPumpMutation = useMutation({
    mutationFn: async (data: { pumpNumber: number; name: string; status: string }) => {
      const response = await apiClient.post(`/stations/${id}/pumps`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
      toast({ title: 'Success', description: 'Pump created successfully' });
      setIsPumpDialogOpen(false);
      setPumpForm({ pumpNumber: '', name: '', status: 'active' });
    },
    onError: (error: unknown) => {
      let message = 'Failed to create pump';
      if (error && typeof error === 'object') {
        if ('response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data) {
          message = (error.response.data as any).error || message;
        } else if ('message' in error && typeof (error as any).message === 'string') {
          message = (error as any).message;
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
    mutationFn: async ({ pumpId, data }: { pumpId: string; data: { nozzleNumber: number; fuelType: string; initialReading: number } }) => {
      const response = await apiClient.post(`/stations/pumps/${pumpId}/nozzles`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
      toast({ title: 'Success', description: 'Nozzle created successfully' });
      setIsNozzleDialogOpen(false);
      setNozzleForm({ nozzleNumber: '', fuelType: 'petrol', initialReading: '' });
      setSelectedPump(null);
    },
    onError: (error: unknown) => {
      let message = 'Failed to create nozzle';
      if (error && typeof error === 'object') {
        if ('response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data) {
          message = (error.response.data as any).error || message;
        } else if ('message' in error && typeof (error as any).message === 'string') {
          message = (error as any).message;
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
      toast({ title: 'Success', description: 'Price updated successfully' });
      setIsPriceDialogOpen(false);
      setPriceForm({ fuelType: 'petrol', price: '', effectiveFrom: formatDateISO(new Date()) });
    },
    onError: (error: unknown) => {
      let message = 'Failed to update price';
      if (error && typeof error === 'object') {
        if ('response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data) {
          message = (error.response.data as any).error || message;
        } else if ('message' in error && typeof (error as any).message === 'string') {
          message = (error as any).message;
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
      const response = await apiClient.post(`/credits/stations/${id}/creditors`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-creditors', id] });
      toast({ title: 'Success', description: 'Creditor created successfully' });
      setIsCreditorDialogOpen(false);
      setCreditorForm({ name: '', phone: '', email: '', creditLimit: '', vehicleNumber: '' });
    },
    onError: (error: unknown) => {
      let message = 'Failed to create creditor';
      if (error && typeof error === 'object') {
        if ('response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data) {
          message = (error.response.data as any).error || message;
        } else if ('message' in error && typeof (error as any).message === 'string') {
          message = (error as any).message;
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
      toast({ title: 'Success', description: 'Pump updated successfully' });
      setIsEditPumpDialogOpen(false);
      setSelectedPump(null);
    },
    onError: (error: unknown) => {
      let message = 'Failed to update pump';
      if (error && typeof error === 'object') {
        if ('response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data) {
          message = (error.response.data as any).error || message;
        } else if ('message' in error && typeof (error as any).message === 'string') {
          message = (error as any).message;
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
      toast({ title: 'Success', description: 'Nozzle updated successfully' });
      setIsEditNozzleDialogOpen(false);
      setSelectedNozzle(null);
    },
    onError: (error: unknown) => {
      let message = 'Failed to update nozzle';
      if (error && typeof error === 'object') {
        if ('response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data) {
          message = (error.response.data as any).error || message;
        } else if ('message' in error && typeof (error as any).message === 'string') {
          message = (error as any).message;
        }
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // Add reading mutation
  const addReadingMutation = useMutation({
    mutationFn: async (data: { nozzleId: string; reading: number; readingDate: string; paymentType: 'cash' | 'digital' | 'credit' }) => {
      const response = await apiClient.post(`/readings`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
      toast({ title: 'Success', description: 'Reading added successfully' });
      setIsReadingDialogOpen(false);
      setReadingForm({ nozzleId: '', readingValue: '', readingDate: formatDateISO(new Date()), paymentType: 'cash' });
      setSelectedNozzle(null);
    },
    onError: (error: unknown) => {
      let message = 'Failed to add reading';
      if (error && typeof error === 'object') {
        if ('response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data) {
          message = (error.response.data as any).error || message;
        } else if ('message' in error && typeof (error as any).message === 'string') {
          message = (error as any).message;
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
    createPumpMutation.mutate({
      pumpNumber: parseInt(pumpForm.pumpNumber),
      name: pumpForm.name,
      status: pumpForm.status
    });
  };

  const handleCreateNozzle = () => {
    if (!selectedPump) return;
    createNozzleMutation.mutate({
      pumpId: selectedPump.id,
      data: {
        nozzleNumber: parseInt(nozzleForm.nozzleNumber),
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
      status: pump.status,
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
      status: nozzle.status,
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

  const handleAddReading = (nozzle: Nozzle) => {
    setSelectedNozzle(nozzle);
    setReadingForm({
      nozzleId: nozzle.id,
      readingValue: '',
      readingDate: formatDateISO(new Date()),
      paymentType: 'cash'
    });
    setIsReadingDialogOpen(true);
  };

  const handleSubmitReading = () => {
    if (!selectedNozzle) return;
    // Convert readingForm to correct payload for mutation
    const payload = mapReadingFormToPayload(readingForm);
    addReadingMutation.mutate({
      nozzleId: payload.nozzleId,
      reading: payload.readingValue, // API expects 'reading'
      readingDate: payload.readingDate,
      paymentType: payload.paymentType
    });
  };

  if (stationLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">Loading station details...</div>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">Station not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/owner/stations')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{station.name}</h1>
            <p className="text-muted-foreground">
              {station.code && `Code: ${station.code} • `}
              {station.city && `${station.city}, ${station.state}`}
            </p>
          </div>
        </div>
        <Badge variant={station.isActive ? 'default' : 'secondary'}>
          {station.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pumps" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pumps">Pumps & Nozzles</TabsTrigger>
          <TabsTrigger value="prices">Fuel Prices</TabsTrigger>
          <TabsTrigger value="creditors">Creditors</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Pumps & Nozzles Tab */}
        <TabsContent value="pumps" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Pumps & Nozzles</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
                  console.log('🔄 Manually refreshing pumps...');
                }}
              >
                Refresh
              </Button>
              <Dialog open={isPumpDialogOpen} onOpenChange={setIsPumpDialogOpen}>
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
                    <Label htmlFor="pumpNumber">Pump Number *</Label>
                    <Input
                      id="pumpNumber"
                      type="number"
                      value={pumpForm.pumpNumber}
                      onChange={(e) => setPumpForm({ ...pumpForm, pumpNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pumpName">Pump Name *</Label>
                    <Input
                      id="pumpName"
                      value={pumpForm.name}
                      onChange={(e) => setPumpForm({ ...pumpForm, name: e.target.value })}
                      placeholder="Pump A"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pumpStatus">Status</Label>
                    <Select
                      value={pumpForm.status}
                      onValueChange={(value) => setPumpForm({ ...pumpForm, status: value as 'active' | 'inactive' | 'maintenance' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
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
                    disabled={!pumpForm.pumpNumber || !pumpForm.name || createPumpMutation.isPending}
                  >
                    {createPumpMutation.isPending ? 'Creating...' : 'Create Pump'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {pumpsLoading ? (
            <div className="text-center py-8">Loading pumps...</div>
          ) : !pumps || !Array.isArray(pumps) || pumps.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Fuel className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No pumps added yet</p>

                <Button onClick={() => setIsPumpDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Pump
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="col-span-full text-sm text-green-600 mb-2">
                ✅ Found {pumps.length} pumps
              </div>
              {pumps.map((pump) => (
                <Card key={pump.id} className="flex flex-col h-full">
                  <CardHeader className="flex-0 pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                      <CardTitle className="text-lg truncate min-w-0">
                        Pump {pump.pumpNumber} - {pump.name}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <Badge variant={pump.status === 'active' ? 'default' : 'secondary'} className="truncate max-w-[80px]">
                          {pump.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditPump(pump)}
                          className="flex-shrink-0"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 flex-1 flex flex-col">
                    {/* Nozzles */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold">Nozzles ({pump.nozzles?.length || 0})</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPump(pump);
                            setIsNozzleDialogOpen(true);
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      {pump.nozzles && pump.nozzles.length > 0 ? (
                        <div className="space-y-2">
                          {pump.nozzles.map((nozzle) => (
                            <div
                              key={nozzle.id}
                              className="flex items-center justify-between text-sm p-2 border rounded"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">N{nozzle.nozzleNumber}</span>
                                <Badge className={getFuelBadgeClasses(nozzle.fuelType)}>
                                  {nozzle.fuelType}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Last: {nozzle.lastReading != null ? toFixedNumber(nozzle.lastReading, 2) : toFixedNumber(nozzle.initialReading, 2)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-xs">
                                  {nozzle.status}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAddReading(nozzle)}
                                  className="h-6 px-2"
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditNozzle(nozzle)}
                                  className="h-6 px-2"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No nozzles added</p>
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
                  <DollarSign className="w-4 h-4 mr-2" />
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
                      onValueChange={(value) => setPriceForm({ ...priceForm, fuelType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="petrol">Petrol</SelectItem>
                        <SelectItem value="diesel">Diesel</SelectItem>
                        <SelectItem value="cng">CNG</SelectItem>
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
            <div className="text-center py-8">Loading prices...</div>
          ) : prices && prices.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {prices.map((price) => (
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
                      Updated {formatDateTimeLocal(price.updatedAt)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
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
            <div className="text-center py-8">Loading creditors...</div>
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
              <CardContent className="py-12 text-center">
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

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Station Employees</h2>
            <Button onClick={() => navigate(`/owner/employees?station=${id}`)}>
              <Users className="w-4 h-4 mr-2" />
              Manage Employees
            </Button>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Employee management will be shown here
              </p>
              <Button variant="outline" onClick={() => navigate(`/owner/employees?station=${id}`)}>
                Go to Employee Management
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <h2 className="text-xl font-semibold">Station Settings</h2>
          <Card>
            <CardContent className="py-12 text-center">
              <Settings className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Station settings will be shown here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Nozzle Dialog */}
      <Dialog open={isNozzleDialogOpen} onOpenChange={setIsNozzleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Nozzle</DialogTitle>
            <DialogDescription>
              Add a new nozzle to {selectedPump?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nozzleNumber">Nozzle Number *</Label>
              <Input
                id="nozzleNumber"
                type="number"
                value={nozzleForm.nozzleNumber}
                onChange={(e) => setNozzleForm({ ...nozzleForm, nozzleNumber: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="nozzleFuelType">Fuel Type *</Label>
              <Select
                value={nozzleForm.fuelType}
                onValueChange={(value) => setNozzleForm({ ...nozzleForm, fuelType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="petrol">Petrol</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="cng">CNG</SelectItem>
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
              disabled={!nozzleForm.nozzleNumber || !nozzleForm.initialReading || createNozzleMutation.isPending}
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
                onValueChange={(value) => setEditPumpForm({ ...editPumpForm, status: value as 'active' | 'inactive' | 'maintenance' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
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
                onValueChange={(value) => setEditNozzleForm({ ...editNozzleForm, status: value as 'active' | 'inactive' | 'maintenance' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
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

      {/* Add Reading Dialog */}
      <Dialog open={isReadingDialogOpen} onOpenChange={setIsReadingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Nozzle Reading</DialogTitle>
            <DialogDescription>
              Record a new reading for Nozzle {selectedNozzle?.nozzleNumber} ({selectedNozzle?.fuelType})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="readingValue">Reading Value *</Label>
              <Input
                id="readingValue"
                type="number"
                step="0.01"
                value={readingForm.readingValue}
                onChange={(e) => setReadingForm({ ...readingForm, readingValue: e.target.value })}
                placeholder="Enter current meter reading"
              />
              {selectedNozzle && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last reading: {selectedNozzle.lastReading != null ? toFixedNumber(selectedNozzle.lastReading, 2) : toFixedNumber(selectedNozzle.initialReading, 2)}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="readingDate">Date *</Label>
              <Input
                id="readingDate"
                type="date"
                value={readingForm.readingDate}
                onChange={(e) => setReadingForm({ ...readingForm, readingDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="paymentType">Payment Type *</Label>
              <Select
                value={readingForm.paymentType}
                onValueChange={(value) => setReadingForm({ ...readingForm, paymentType: value as 'cash' | 'digital' | 'credit' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="digital">Digital</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsReadingDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitReading}
              disabled={!readingForm.readingValue || addReadingMutation.isPending}
            >
              {addReadingMutation.isPending ? 'Adding...' : 'Add Reading'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
