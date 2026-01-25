import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getFuelBadgeClasses, getFuelColors } from '@/lib/fuelColors';
import { apiClient } from "@/lib/api-client";
import { Plus, Fuel, Gauge, ClipboardEdit } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePumpsData } from "@/hooks/usePumpsData";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { EquipmentStatusEnum, FuelTypeEnum, FuelType } from "@/core/enums";
import { FuelTypeSelect } from '@/components/FuelTypeSelect';

export default function Pumps() {
  const navigate = useNavigate();
  const [isAddPumpOpen, setIsAddPumpOpen] = useState(false);
  const [isAddNozzleOpen, setIsAddNozzleOpen] = useState(false);
  const [selectedPumpId, setSelectedPumpId] = useState<string | null>(null);
  const [newPump, setNewPump] = useState({
    name: '',
    is_active: true
  });
  const [newNozzle, setNewNozzle] = useState({
    fuel_type: FuelTypeEnum.PETROL as FuelTypeEnum
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pumps, isLoading, error } = usePumpsData();
  const { currentStation, isOwner, isAdmin } = useRoleAccess();

  // Add pump mutation - uses /stations/:stationId/pumps
  const addPumpMutation = useMutation({
    mutationFn: async (pumpData: typeof newPump) => {
      if (!currentStation?.id) throw new Error('No station selected');
      return await apiClient.post<{ success: boolean; data: unknown }>(`/stations/${currentStation.id}/pumps`, {
        name: pumpData.name,
        status: pumpData.is_active ? EquipmentStatusEnum.ACTIVE : EquipmentStatusEnum.INACTIVE
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pumps'] });
      if (currentStation?.id) {
        queryClient.invalidateQueries({ queryKey: ['pumps-data', currentStation.id] });
      }
      setIsAddPumpOpen(false);
      setNewPump({ name: '', is_active: true });
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
    mutationFn: async (nozzleData: { fuel_type: FuelTypeEnum; pump_id: string }) => {
      return await apiClient.post<{ success: boolean; data: unknown }>(`/stations/pumps/${nozzleData.pump_id}/nozzles`, {
        fuelType: nozzleData.fuel_type,
        initialReading: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pumps'] });
      if (currentStation?.id) {
        queryClient.invalidateQueries({ queryKey: ['pumps-data', currentStation.id] });
      }
      setIsAddNozzleOpen(false);
      setSelectedPumpId(null);
      setNewNozzle({ fuel_type: FuelTypeEnum.PETROL });
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
    if (!newPump.name) {
      toast({
        title: "Missing Information",
        description: "Please fill in pump name",
        variant: "destructive",
      });
      return;
    }

    // Backend auto-generates pump number and handles validation
    addPumpMutation.mutate(newPump);
  };

  const handleAddNozzle = () => {
    if (!selectedPumpId) {
      toast({
        title: "Missing Information",
        description: "Please select a pump",
        variant: "destructive",
      });
      return;
    }

    // Backend auto-generates nozzle number
    addNozzleMutation.mutate({
      fuel_type: newNozzle.fuel_type,
      pump_id: selectedPumpId
    });
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

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-red-600">
              Error loading pumps: {error.message || 'Unknown error'}
            </p>
            <p className="text-center text-sm text-muted-foreground mt-2">
              Current station: {currentStation ? currentStation.name : 'None'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 page-container space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">Pump Management</h1>
          <p className="text-muted-foreground">
            Manage pumps and nozzles {currentStation ? `for ${currentStation.name}` : 'across all stations'}
          </p>
        </div>
        
        <div className="flex gap-2">
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


      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {Array.isArray(pumps) && pumps.length > 0 ? pumps.map((pump) => (
          <Card key={pump.id} className="relative shadow-lg hover:shadow-2xl transition-shadow duration-200">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Fuel className="w-6 h-6 text-blue-500" />
                    {pump.name}
                  </CardTitle>
                  <CardDescription className="text-base text-gray-500">
                    Pump #{pump.pumpNumber}
                  </CardDescription>
                </div>
                <Badge className={pump.status === EquipmentStatusEnum.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {pump.status === EquipmentStatusEnum.ACTIVE ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-lg">Nozzles <span className="text-xs text-muted-foreground">({pump.nozzles?.length || 0})</span></h4>
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
                            <Label htmlFor="fuel_type">Fuel Type</Label>
                            <FuelTypeSelect
                              value={newNozzle.fuel_type}
                              onValueChange={(value: FuelType) => setNewNozzle(prev => ({ ...prev, fuel_type: value as FuelTypeEnum }))}
                            />
                          </div>
                          <Button onClick={handleAddNozzle} disabled={addNozzleMutation.isPending} className="w-full">
                            {addNozzleMutation.isPending ? 'Adding...' : 'Add Nozzle'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {pump.nozzles?.map((nozzle) => {
                    // Use API property names: fuelType, nozzleNumber
                    const fuelColors = getFuelColors(nozzle.fuelType);
                    return (
                      <div
                        key={nozzle.id}
                        className={`flex flex-col min-w-[170px] max-w-[260px] flex-1 p-3 rounded-xl border shadow-sm ${fuelColors.bg} ${fuelColors.text} ${fuelColors.border} transition-all duration-200`}
                        style={{ borderWidth: 2 }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-3 h-3 rounded-full ${fuelColors.dot}`} />
                          <span className="font-semibold">Nozzle #{nozzle.nozzleNumber}</span>
                          <Badge className={`ml-2 px-1.5 py-0.5 text-xs break-words max-w-[120px] whitespace-normal leading-tight ${fuelColors.bg} ${fuelColors.text} border-none`}>{nozzle.fuelType}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <Gauge className="w-4 h-4 opacity-70" />
                          <span className="text-xs">{nozzle.status === EquipmentStatusEnum.ACTIVE ? 'Active' : 'Inactive'}</span>
                        </div>
                        {nozzle.lastReading ? (
                          <div className="text-xs text-gray-700 ml-1">
                            Last: {nozzle.lastReading.toLocaleString()} L
                          </div>
                        ) : (
                          <div className="text-xs text-gray-700 ml-1">
                            Initial: {nozzle.initialReading?.toLocaleString() || 0} L
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <Fuel className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No pumps found</h3>
              <p className="text-muted-foreground">
                {currentStation ? `No pumps configured for ${currentStation.name}` : 'No station selected'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {(!Array.isArray(pumps) || pumps.length === 0) && (
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
