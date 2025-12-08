
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService } from '@/services/api';
import { NozzleReading } from '@/types/api';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getFuelBadgeClasses } from '@/lib/fuelColors';
import { FuelType, FuelTypeEnum } from '@/core/enums';

export default function NozzleReadings() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingReading, setEditingReading] = useState<NozzleReading | null>(null);
  const [newReading, setNewReading] = useState({
    pump_sno: '',
    nozzle_id: 1,
    cumulative_volume: 0,
    reading_date: new Date().toISOString().split('T')[0],
    reading_time: new Date().toTimeString().slice(0, 5),
    fuel_type: FuelTypeEnum.PETROL as FuelType
  });

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentStation = user?.stations?.[0];

  const { data: readingsData, isLoading } = useQuery({
    queryKey: ['nozzle-readings', currentStation?.id],
    queryFn: async () => {
      if (!currentStation) return { data: [] };
      return await apiService.getNozzleReadings(currentStation.id);
    },
    enabled: !!currentStation
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newReading) => {
      if (!currentStation) throw new Error('No station selected');
      return apiService.createManualReading(data, currentStation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nozzle-readings'] });
      setShowAddDialog(false);
      setNewReading({
        pump_sno: '',
        nozzle_id: 1,
        cumulative_volume: 0,
        reading_date: new Date().toISOString().split('T')[0],
        reading_time: new Date().toTimeString().slice(0, 5),
        fuel_type: FuelTypeEnum.PETROL
      });
      toast({
        title: "Success",
        description: "Reading added successfully",
      });
    },
    onError: (error: unknown) => {
      let message = "Failed to add reading";
      if (typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string") {
        message = (error as { message: string }).message;
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { cumulative_volume: number; fuel_type: FuelType } }) =>
      apiService.updateNozzleReading(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nozzle-readings'] });
      setEditingReading(null);
      toast({
        title: "Success",
        description: "Reading updated successfully",
      });
    },
    onError: (error: unknown) => {
      let message = "Failed to update reading";
      if (typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string") {
        message = (error as { message: string }).message;
      }
      toast({
        title: "Error", 
        description: message,
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteNozzleReading(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nozzle-readings'] });
      toast({
        title: "Success",
        description: "Reading deleted successfully",
      });
    },
    onError: (error: unknown) => {
      let message = "Failed to delete reading";
      if (typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string") {
        message = (error as { message: string }).message;
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(newReading);
  };

  const handleEdit = (reading: NozzleReading) => {
    setEditingReading(reading);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingReading) {
      updateMutation.mutate({
        id: editingReading.id,
        data: {
          cumulative_volume: editingReading.cumulativeVolume,
          fuel_type: editingReading.fuelType as FuelType
        }
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this reading?')) {
      deleteMutation.mutate(id);
    }
  };

  const readings = readingsData?.data || [];

  const getStatusBadge = (isManual: boolean) => {
    return isManual ? (
      <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">
        Manual
      </Badge>
    ) : (
      <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
        Parsed
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nozzle Readings</h1>
            <p className="text-muted-foreground mt-1">
            View and manage fuel nozzle readings from parsed and manual entries.
          </p>
        </div>
        {/* Manual entry disabled — readings allowed only via Quick Entry (DataEntry) */}
      </div>

      {/* Readings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Readings</CardTitle>
          <CardDescription>
            Latest nozzle readings from parsed and manual entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <span className="text-2xl">⏳</span>
              <p className="text-muted-foreground mt-2">Loading readings...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {readings.map((reading) => (
                <div key={reading.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{reading.fuelType === FuelTypeEnum.PETROL ? '⛽' : '🚛'}</span>
                    <div>
                      <p className="font-medium">
                        {reading.pumpSno} - Nozzle {reading.nozzleId}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(reading.readingDate).toLocaleDateString()} at {reading.readingTime}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getFuelBadgeClasses(reading.fuelType)}>{reading.fuelType}</Badge>
                        {getStatusBadge(reading.isManualEntry)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">{reading.cumulativeVolume.toLocaleString()}L</p>
                      <p className="text-sm text-muted-foreground">Cumulative</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" disabled className="text-red-600">
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              {readings.length === 0 && (
                <div className="text-center py-8">
                  <span className="text-4xl">📊</span>
                  <p className="text-muted-foreground mt-2">No readings yet</p>
                  <p className="text-sm text-muted-foreground">Upload receipts or add manual readings to get started</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingReading && (
        <Dialog open={!!editingReading} onOpenChange={() => setEditingReading(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Reading</DialogTitle>
              <DialogDescription>
                Update the nozzle reading details
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <Label>Pump: {editingReading.pumpSno} - Nozzle {editingReading.nozzleId}</Label>
              </div>

              <div>
                <Label htmlFor="edit_fuel_type">Fuel Type</Label>
                <Select
                  value={editingReading.fuelType}
                  onValueChange={(value: FuelType) => 
                    setEditingReading(prev => prev ? { ...prev, fuelType: value } : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
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

              <div>
                <Label htmlFor="edit_cumulative_volume">Cumulative Volume (L)</Label>
                <Input
                  id="edit_cumulative_volume"
                  type="number"
                  step="0.001"
                  value={editingReading.cumulativeVolume}
                  onChange={(e) => 
                    setEditingReading(prev => prev ? { ...prev, cumulativeVolume: parseFloat(e.target.value) || 0 } : null)
                  }
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating...' : 'Update Reading'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingReading(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
