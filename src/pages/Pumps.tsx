import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getFuelBadgeClasses } from '@/lib/fuelColors';
import { apiClient, ApiResponse } from "@/lib/api-client";
import { Plus, Settings, Fuel, Gauge, ClipboardEdit } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePumpsData } from "@/hooks/usePumpsData";
import { useRoleAccess } from "@/hooks/useRoleAccess";

export default function Pumps() {
  const navigate = useNavigate();
  const [isAddPumpOpen, setIsAddPumpOpen] = useState(false);
  const [isAddNozzleOpen, setIsAddNozzleOpen] = useState(false);
  const [selectedPumpId, setSelectedPumpId] = useState<string | null>(null);
  const [newPump, setNewPump] = useState({
    pump_sno: '',
    name: '',
    is_active: true
  });
  const [newNozzle, setNewNozzle] = useState({
    nozzle_number: '',
    fuel_type: 'PETROL' as 'PETROL' | 'DIESEL' | 'CNG' | 'EV'
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pumps, isLoading } = usePumpsData();
  const { currentStation, isOwner, isAdmin } = useRoleAccess();

  // Add pump mutation - uses /stations/:stationId/pumps
  const addPumpMutation = useMutation({
    mutationFn: async (pumpData: typeof newPump) => {
      if (!currentStation?.id) throw new Error('No station selected');
      return await apiClient.post<{ success: boolean; data: unknown }>(`/stations/${currentStation.id}/pumps`, {
        pumpNumber: parseInt(pumpData.pump_sno.replace(/\D/g, '') || '0') || 1,
        name: pumpData.name,
        status: pumpData.is_active ? 'active' : 'inactive'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pumps'] });
      setIsAddPumpOpen(false);
      setNewPump({ pump_sno: '', name: '', is_active: true });
      toast({
        title: "Success",
        description: "Pump added successfully",
      });
    },
    onError: (error: unknown) => {
      let errorMessage = "Failed to add pump";
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message?: string }).message || errorMessage;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Add nozzle mutation - uses /stations/pumps/:pumpId/nozzles
  const addNozzleMutation = useMutation({
    mutationFn: async (nozzleData: { nozzle_number: number; fuel_type: 'PETROL' | 'DIESEL' | 'CNG' | 'EV'; pump_id: string }) => {
      return await apiClient.post<{ success: boolean; data: unknown }>(`/stations/pumps/${nozzleData.pump_id}/nozzles`, {
        nozzleNumber: nozzleData.nozzle_number,
        fuelType: nozzleData.fuel_type.toLowerCase() as 'petrol' | 'diesel',
        initialReading: 0, // Required by backend
        status: 'active'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pumps'] });
      setIsAddNozzleOpen(false);
      setSelectedPumpId(null);
      setNewNozzle({ nozzle_number: '', fuel_type: 'PETROL' });
      toast({
        title: "Success",
        description: "Nozzle added successfully",
      });
    },
    onError: (error: unknown) => {
      let errorMessage = "Failed to add nozzle";
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message?: string }).message || errorMessage;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleAddPump = () => {
    if (!newPump.pump_sno || !newPump.name) {
      toast({
        title: "Missing Information",
        description: "Please fill in pump serial number and name",
        variant: "destructive",
      });
      return;
    }

    // ⭐ CLIENT-SIDE VALIDATION: Check for duplicate pump number
    const pumpNumber = parseInt(newPump.pump_sno.replace(/\D/g, '') || '0') || 1;
    const isDuplicatePump = pumps?.some(p => p.pumpNumber === pumpNumber);
    if (isDuplicatePump) {
      toast({
        title: "Duplicate Pump Number",
        description: `Pump number ${pumpNumber} already exists. Please use a different number.`,
        variant: "destructive",
      });
      return;
    }

    addPumpMutation.mutate(newPump);
  };

  const handleAddNozzle = () => {
    if (!newNozzle.nozzle_number || !selectedPumpId) {
      toast({
        title: "Missing Information",
        description: "Please fill in nozzle number",
        variant: "destructive",
      });
      return;
    }

    // ⭐ CLIENT-SIDE VALIDATION: Check for duplicate nozzle number on this pump
    const nozzleNumber = parseInt(newNozzle.nozzle_number);
    const selectedPump = pumps?.find(p => p.id === selectedPumpId);
    const isDuplicateNozzle = selectedPump?.nozzles?.some(n => n.nozzleNumber === nozzleNumber);
    if (isDuplicateNozzle) {
      toast({
        title: "Duplicate Nozzle Number",
        description: `Nozzle number ${nozzleNumber} already exists on this pump. Please use a different number.`,
        variant: "destructive",
      });
      return;
    }

    addNozzleMutation.mutate({
      nozzle_number: nozzleNumber,
      fuel_type: newNozzle.fuel_type,
      pump_id: selectedPumpId
    });
  };

  const getStatusColor = (status: boolean) => {
    return status ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  if (!currentStation && !isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No station assigned to your account. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading pumps...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pump Management</h1>
          <p className="text-muted-foreground">
            Manage pumps and nozzles {currentStation ? `for ${currentStation.name}` : 'across all stations'}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/data-entry')}>
            <ClipboardEdit className="w-4 h-4 mr-2" />
            Enter Readings
          </Button>
          
          {(isOwner || isAdmin) && (
            <Dialog open={isAddPumpOpen} onOpenChange={setIsAddPumpOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Pump
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Pump</DialogTitle>
                <DialogDescription>
                  Add a new pump to the station
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="pump_sno">Pump Serial Number</Label>
                  <Input
                    id="pump_sno"
                    value={newPump.pump_sno}
                    onChange={(e) => setNewPump(prev => ({ ...prev, pump_sno: e.target.value }))}
                    placeholder="e.g., P001"
                  />
                </div>
                <div>
                  <Label htmlFor="name">Pump Name</Label>
                  <Input
                    id="name"
                    value={newPump.name}
                    onChange={(e) => setNewPump(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Main Pump 1"
                  />
                </div>
                <Button onClick={handleAddPump} disabled={addPumpMutation.isPending} className="w-full">
                  {addPumpMutation.isPending ? 'Adding...' : 'Add Pump'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pumps?.map((pump) => (
          <Card key={pump.id} className="relative">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Fuel className="w-5 h-5" />
                    {pump.name}
                  </CardTitle>
                  <CardDescription>
                    Serial: {pump.pump_sno}
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(pump.is_active)}>
                  {pump.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Nozzles ({pump.nozzles?.length || 0})</h4>
                  {(isOwner || isAdmin) && (
                    <Dialog open={isAddNozzleOpen && selectedPumpId === String(pump.id)} onOpenChange={(open) => {
                      setIsAddNozzleOpen(open);
                      if (open) setSelectedPumpId(String(pump.id));
                      else setSelectedPumpId(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="w-3 h-3 mr-1" />
                          Add Nozzle
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Nozzle to {pump.name}</DialogTitle>
                          <DialogDescription>
                            Add a new nozzle to this pump
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="nozzle_number">Nozzle Number</Label>
                            <Input
                              id="nozzle_number"
                              type="number"
                              value={newNozzle.nozzle_number}
                              onChange={(e) => setNewNozzle(prev => ({ ...prev, nozzle_number: e.target.value }))}
                              placeholder="e.g., 1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="fuel_type">Fuel Type</Label>
                            <Select value={newNozzle.fuel_type} onValueChange={(value: 'PETROL' | 'DIESEL' | 'CNG' | 'EV') => setNewNozzle(prev => ({ ...prev, fuel_type: value }))}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PETROL">Petrol</SelectItem>
                                <SelectItem value="DIESEL">Diesel</SelectItem>
                                <SelectItem value="CNG">CNG</SelectItem>
                                <SelectItem value="EV">EV Charging</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={handleAddNozzle} disabled={addNozzleMutation.isPending} className="w-full">
                            {addNozzleMutation.isPending ? 'Adding...' : 'Add Nozzle'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                
                <div className="space-y-2">
                  {pump.nozzles?.map((nozzle) => (
                    <div key={nozzle.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Gauge className="w-4 h-4" />
                          <span className="font-medium">Nozzle #{nozzle.nozzle_number}</span>
                          <Badge className={getFuelBadgeClasses(nozzle.fuel_type)}>
                            {nozzle.fuel_type}
                          </Badge>
                          <Badge variant="outline" className={getStatusColor(nozzle.is_active)}>
                            {nozzle.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {nozzle.lastReading && (
                          <div className="text-xs text-muted-foreground ml-6">
                            Last: {nozzle.lastReading.toLocaleString()} L
                          </div>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => navigate('/data-entry')}
                        className="ml-2"
                      >
                        <ClipboardEdit className="w-3 h-3 mr-1" />
                        Enter
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!pumps || pumps.length === 0) && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Fuel className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No pumps found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding your first pump to the station.
            </p>
            {(isOwner || isAdmin) && (
              <Button onClick={() => setIsAddPumpOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Pump
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
