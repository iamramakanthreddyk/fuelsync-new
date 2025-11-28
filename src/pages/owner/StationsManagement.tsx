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
  Settings
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
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create station',
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
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to update station',
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
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete station',
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
            <Card key={station.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">{station.name}</CardTitle>
                  </div>
                  <Badge variant={station.isActive ? 'default' : 'secondary'}>
                    {station.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {station.code && (
                  <CardDescription>Code: {station.code}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Location */}
                {(station.address || station.city) && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div>
                      {station.address && <div>{station.address}</div>}
                      {station.city && (
                        <div>{station.city}{station.state && `, ${station.state}`} {station.pincode}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Contact */}
                <div className="space-y-1 text-sm">
                  {station.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{station.phone}</span>
                    </div>
                  )}
                  {station.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate">{station.email}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pumps:</span>
                  <span className="font-semibold">
                    {station.activePumps}/{station.pumpCount}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/owner/stations/${station.id}`)}
                  >
                    View Details
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(station)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteStationId(station.id)}
                  >
                    <Trash2 className="w-4 h-4" />
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
