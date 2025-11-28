/**
 * Station Detail Page
 * Comprehensive view of a single station with pumps, nozzles, fuel prices
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { apiClient } from '@/lib/api-client';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Fuel,
  Settings,
  DollarSign,
  Users
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

export default function StationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  console.log('🚀 StationDetail COMPONENT MOUNTED - ID:', id);
  
  const [isPumpDialogOpen, setIsPumpDialogOpen] = useState(false);
  const [isNozzleDialogOpen, setIsNozzleDialogOpen] = useState(false);
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [selectedPump, setSelectedPump] = useState<Pump | null>(null);

  const [pumpForm, setPumpForm] = useState({
    pumpNumber: '',
    name: '',
    status: 'active' as const
  });

  const [nozzleForm, setNozzleForm] = useState({
    nozzleNumber: '',
    fuelType: 'petrol',
    initialReading: ''
  });

  const [priceForm, setPriceForm] = useState({
    fuelType: 'petrol',
    price: '',
    effectiveFrom: new Date().toISOString().split('T')[0]
  });

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

  // Create pump mutation
  const createPumpMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post(`/stations/${id}/pumps`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
      toast({ title: 'Success', description: 'Pump created successfully' });
      setIsPumpDialogOpen(false);
      setPumpForm({ pumpNumber: '', name: '', status: 'active' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create pump',
        variant: 'destructive'
      });
    }
  });

  // Create nozzle mutation
  const createNozzleMutation = useMutation({
    mutationFn: async ({ pumpId, data }: { pumpId: string; data: any }) => {
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
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create nozzle',
        variant: 'destructive'
      });
    }
  });

  // Set price mutation
  const setPriceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post(`/stations/${id}/prices`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-prices', id] });
      toast({ title: 'Success', description: 'Price updated successfully' });
      setIsPriceDialogOpen(false);
      setPriceForm({ fuelType: 'petrol', price: '', effectiveFrom: new Date().toISOString().split('T')[0] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to update price',
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
      price: parseFloat(priceForm.price),
      effectiveFrom: priceForm.effectiveFrom
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
                      onValueChange={(value: any) => setPumpForm({ ...pumpForm, status: value })}
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
                <div className="text-xs text-red-500 mb-4">
                  Debug: pumps={JSON.stringify(pumps)}, isArray={String(Array.isArray(pumps))}, length={pumps?.length}
                </div>
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
                <Card key={pump.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        Pump {pump.pumpNumber} - {pump.name}
                      </CardTitle>
                      <Badge variant={pump.status === 'active' ? 'default' : 'secondary'}>
                        {pump.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                              <div>
                                <span className="font-medium">N{nozzle.nozzleNumber}</span>
                                <span className="mx-2">•</span>
                                <span className="capitalize">{nozzle.fuelType}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {nozzle.status}
                              </Badge>
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
                      Effective from {new Date(price.effectiveFrom).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">₹{price.price.toFixed(2)}</div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Updated {new Date(price.updatedAt).toLocaleString()}
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
    </div>
  );
}
