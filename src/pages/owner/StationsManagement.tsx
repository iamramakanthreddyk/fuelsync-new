/**
 * Owner Stations Management
 * Complete CRUD for managing stations
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { 
  Plus, 
  Building2, 
  Edit, 
  Trash2,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  Settings,
  Fuel,
  TrendingUp,
  Clock
} from 'lucide-react';

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
  gstNumber: string;
  isActive: boolean;
  pumpCount: number;
  activePumps: number;
  todaySales?: number;
  lastReading?: string;
  createdAt: string;
}

interface StationFormData {
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  gstNumber: string;
}

const initialFormData: StationFormData = {
  name: '',
  code: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
  email: '',
  gstNumber: ''
};

export default function StationsManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteStationId, setDeleteStationId] = useState<string | null>(null);
  const [formData, setFormData] = useState<StationFormData>(initialFormData);
  const [editingStation, setEditingStation] = useState<Station | null>(null);

  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch stations
  const { data: stations, isLoading } = useQuery({
    queryKey: ['owner-stations'],
    queryFn: async () => {
      const response = await apiClient.get<Station[]>('/stations');
      return response;
    }
  });

  // Create station mutation
  const createMutation = useMutation({
    mutationFn: async (data: StationFormData) => {
      const response = await apiClient.post('/stations', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-stations'] });
      toast({
        title: 'Success',
        description: 'Station created successfully'
      });
      setIsAddDialogOpen(false);
      setFormData(initialFormData);
    },
    onError: (error: unknown) => {
      let message = 'Failed to create station';
      if (error && typeof error === 'object') {
        const errObj = error as { response?: { data?: { error?: string } } };
        if (
          errObj.response &&
          typeof errObj.response === 'object' &&
          errObj.response.data &&
          typeof errObj.response.data === 'object' &&
          'error' in errObj.response.data
        ) {
          message = errObj.response.data.error || message;
        }
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // Update station mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: StationFormData }) => {
      const response = await apiClient.put(`/stations/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-stations'] });
      toast({
        title: 'Success',
        description: 'Station updated successfully'
      });
      setIsEditDialogOpen(false);
      setEditingStation(null);
      setFormData(initialFormData);
    },
    onError: (error: unknown) => {
      let message = 'Failed to update station';
      if (error && typeof error === 'object') {
        const errObj = error as { response?: { data?: { error?: string } } };
        if (
          errObj.response &&
          typeof errObj.response === 'object' &&
          errObj.response.data &&
          typeof errObj.response.data === 'object' &&
          'error' in errObj.response.data
        ) {
          message = errObj.response.data.error || message;
        }
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // Delete station mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/stations/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-stations'] });
      toast({
        title: 'Success',
        description: 'Station deleted successfully'
      });
      setDeleteStationId(null);
    },
    onError: (error: unknown) => {
      let message = 'Failed to delete station';
      if (error && typeof error === 'object') {
        const errObj = error as { response?: { data?: { error?: string } } };
        if (
          errObj.response &&
          typeof errObj.response === 'object' &&
          errObj.response.data &&
          typeof errObj.response.data === 'object' &&
          'error' in errObj.response.data
        ) {
          message = errObj.response.data.error || message;
        }
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (editingStation) {
      updateMutation.mutate({ id: editingStation.id, data: formData });
    }
  };

  const handleEdit = (station: Station) => {
    setEditingStation(station);
    setFormData({
      name: station.name,
      code: station.code,
      address: station.address || '',
      city: station.city || '',
      state: station.state || '',
      pincode: station.pincode || '',
      phone: station.phone || '',
      email: station.email || '',
      gstNumber: station.gstNumber || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteStationId) {
      deleteMutation.mutate(deleteStationId);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading stations...</div>
      </div>
    );
  }

  const StationForm = () => (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Station Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Main Station"
          />
        </div>
        <div>
          <Label htmlFor="code">Station Code</Label>
          <Input
            id="code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="ST001"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Street address"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="Mumbai"
          />
        </div>
        <div>
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            placeholder="Maharashtra"
          />
        </div>
        <div>
          <Label htmlFor="pincode">Pincode</Label>
          <Input
            id="pincode"
            value={formData.pincode}
            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
            placeholder="400001"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+91-9876543210"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="station@example.com"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="gstNumber">GST Number</Label>
        <Input
          id="gstNumber"
          value={formData.gstNumber}
          onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
          placeholder="27AABCU9603R1ZX"
        />
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stations Management</h1>
          <p className="text-muted-foreground">Manage your fuel stations</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Station
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Station</DialogTitle>
              <DialogDescription>
                Create a new fuel station
              </DialogDescription>
            </DialogHeader>
            <StationForm />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={createMutation.isPending || !formData.name}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Station'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stations List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              Loading stations...
            </div>
          </CardContent>
        </Card>
      ) : stations && stations.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stations.map((station) => (
            <Card 
              key={station.id} 
              className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer"
              onClick={() => navigate(`/owner/stations/${station.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">{station.name}</CardTitle>
                      {station.code && (
                        <CardDescription className="text-xs">Code: {station.code}</CardDescription>
                      )}
                    </div>
                  </div>
                  <Badge 
                    variant={station.isActive ? 'default' : 'secondary'}
                    className="flex-shrink-0 ml-2"
                  >
                    {station.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3" onClick={(e) => e.stopPropagation()}>
                {/* Today's Sales - Prominent */}
                {station.todaySales !== undefined && station.todaySales !== null && (
                  <div className="bg-gradient-to-r from-green-50 to-transparent p-3 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-muted-foreground">Today's Sales</span>
                      </div>
                      <span className="text-lg font-bold text-green-700">
                        ₹{station.todaySales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/50 p-2 rounded-lg">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Fuel className="w-3 h-3" />
                      <span>Pumps</span>
                    </div>
                    <div className="font-semibold">
                      {station.activePumps}/{station.pumpCount}
                      <span className="text-xs text-muted-foreground ml-1">active</span>
                    </div>
                  </div>

                  {station.lastReading && (
                    <div className="bg-muted/50 p-2 rounded-lg">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Clock className="w-3 h-3" />
                        <span>Last Entry</span>
                      </div>
                      <div className="text-xs font-medium">
                        {new Date(station.lastReading).toLocaleDateString('en-IN', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Location */}
                {(station.city || station.address) && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <div className="line-clamp-2 min-w-0">
                      {station.city && <span>{station.city}{station.state && `, ${station.state}`}</span>}
                    </div>
                  </div>
                )}

                {/* Contact */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {station.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3" />
                      <span>{station.phone}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/owner/stations/${station.id}`);
                    }}
                  >
                    <ArrowRight className="w-3 h-3 mr-1.5" />
                    Manage
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(station);
                    }}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteStationId(station.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Building2 className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">No Stations Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Get started by adding your first fuel station
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Station
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Station</DialogTitle>
            <DialogDescription>
              Update station information
            </DialogDescription>
          </DialogHeader>
          <StationForm />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={updateMutation.isPending || !formData.name}
            >
              {updateMutation.isPending ? 'Updating...' : 'Update Station'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteStationId} onOpenChange={() => setDeleteStationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Station</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this station? This action cannot be undone.
              All associated data (pumps, nozzles, readings) will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
