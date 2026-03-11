import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Fuel, CheckCircle2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { extractApiArray } from '@/lib/api-response';
import { EquipmentStatusEnum, EquipmentStatus, FuelType, FuelTypeEnum } from '@/core/enums';
import { Pump, Nozzle } from '@/types/api';
import { AddPumpDialog, EditPumpDialog, AddNozzleDialog, EditNozzleDialog } from './dialogs';
import { PumpCard } from './cards';
import { PermissionGuard } from '@/hooks/usePermissions';

interface PumpsTabProps {
  id: string;
}

export default function PumpsTab({ id }: PumpsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isPumpDialogOpen, setIsPumpDialogOpen] = useState(false);
  const [isNozzleDialogOpen, setIsNozzleDialogOpen] = useState(false);
  const [isEditPumpDialogOpen, setIsEditPumpDialogOpen] = useState(false);
  const [isEditNozzleDialogOpen, setIsEditNozzleDialogOpen] = useState(false);

  const [selectedPump, setSelectedPump] = useState<Pump | null>(null);
  const [selectedNozzle, setSelectedNozzle] = useState<Nozzle | null>(null);

  const [pumpForm, setPumpForm] = useState({ pumpNumber: '', name: '', status: EquipmentStatusEnum.ACTIVE });
  const [nozzleForm, setNozzleForm] = useState({ fuelType: FuelTypeEnum.PETROL as FuelType, initialReading: '' });
  const [editPumpForm, setEditPumpForm] = useState<{ name: string; status: EquipmentStatus; notes: string }>({ name: '', status: EquipmentStatusEnum.ACTIVE, notes: '' });
  const [editNozzleForm, setEditNozzleForm] = useState<{ status: EquipmentStatus; notes: string }>({ status: EquipmentStatusEnum.ACTIVE, notes: '' });

  // Fetch pumps
  const { data: pumps, isLoading: pumpsLoading } = useQuery({
    queryKey: ['station-pumps', id],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Pump[] }>(`/stations/${id}/pumps`);
      return extractApiArray(response, []);
    },
    enabled: !!id
  });

  // Mutations
  const createPumpMutation = useMutation({
    mutationFn: async (data: { name: string; status: EquipmentStatus }) => {
      return await apiClient.post(`/stations/${id}/pumps`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
      toast({ title: 'Success', description: 'Fuel Dispenser created successfully', variant: 'success' });
      setIsPumpDialogOpen(false);
      setPumpForm({ pumpNumber: '', name: '', status: EquipmentStatusEnum.ACTIVE });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to create pump';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  });

  const createNozzleMutation = useMutation({
    mutationFn: async ({ pumpId, data }: { pumpId: string; data: { fuelType: string; initialReading: number } }) => {
      return await apiClient.post(`/stations/pumps/${pumpId}/nozzles`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
      toast({ title: 'Success', description: 'Nozzle created successfully', variant: 'success' });
      setIsNozzleDialogOpen(false);
      setNozzleForm({ fuelType: 'petrol', initialReading: '' });
      setSelectedPump(null);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to create nozzle';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  });

  const updatePumpMutation = useMutation({
    mutationFn: async ({ pumpId, data }: { pumpId: string; data: { name: string; status: string; notes?: string } }) => {
      return await apiClient.put(`/stations/pumps/${pumpId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
      toast({ title: 'Success', description: 'Fuel Dispenser updated successfully', variant: 'success' });
      setIsEditPumpDialogOpen(false);
      setSelectedPump(null);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to update pump';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  });

  const updateNozzleMutation = useMutation({
    mutationFn: async ({ nozzleId, data }: { nozzleId: string; data: { status: string } }) => {
      return await apiClient.put(`/stations/nozzles/${nozzleId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['station-pumps', id] });
      toast({ title: 'Success', description: 'Nozzle updated successfully', variant: 'success' });
      setIsEditNozzleDialogOpen(false);
      setSelectedNozzle(null);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to update nozzle';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  });

  const handleCreatePump = () => {
    if (!pumpForm.name) {
      toast({ title: 'Missing Information', description: 'Please fill in dispenser name', variant: 'destructive' });
      return;
    }
    createPumpMutation.mutate({ name: pumpForm.name, status: pumpForm.status });
  };

  const handleCreateNozzle = () => {
    if (!selectedPump) return;
    createNozzleMutation.mutate({
      pumpId: selectedPump.id,
      data: { fuelType: nozzleForm.fuelType, initialReading: parseFloat(nozzleForm.initialReading) }
    });
  };

  const handleEditPump = (pump: Pump) => {
    setSelectedPump(pump);
    setEditPumpForm({
      name: pump.name,
      status: pump.status === 'offline' ? EquipmentStatusEnum.INACTIVE : (pump.status as EquipmentStatus),
      notes: pump.notes || ''
    });
    setIsEditPumpDialogOpen(true);
  };

  const handleUpdatePump = () => {
    if (!selectedPump) return;
    updatePumpMutation.mutate({ pumpId: selectedPump.id, data: editPumpForm });
  };

  const handleEditNozzle = (nozzle: Nozzle) => {
    setSelectedNozzle(nozzle);
    setEditNozzleForm({
      status: nozzle.status === 'offline' ? EquipmentStatusEnum.INACTIVE : (nozzle.status as EquipmentStatus),
      notes: ''
    });
    setIsEditNozzleDialogOpen(true);
  };

  const handleUpdateNozzle = () => {
    if (!selectedNozzle) return;
    updateNozzleMutation.mutate({ nozzleId: selectedNozzle.id, data: editNozzleForm });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-bold">Fuel Dispensers & Nozzles</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Manage fuel dispensers and their nozzles</p>
          </div>
          <div className="flex gap-2 flex-shrink-0 justify-center sm:justify-end">
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['station-pumps', id] })}
              size="sm"
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <PermissionGuard permission="manage_stations" roles={["owner","super_admin"]} fallback={<Button size="sm" className="w-full" disabled><Plus className="w-4 h-4 mr-2"/>Add Dispenser</Button>}>
              <Button size="sm" className="w-full" onClick={() => setIsPumpDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Dispenser
              </Button>
            </PermissionGuard>
          </div>
        </div>

        {/* Summary Cards */}
        <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-center gap-2 sm:gap-3 flex-1">
                <div className="p-1.5 bg-blue-500 rounded-lg flex-shrink-0">
                  <Fuel className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg sm:text-xl font-bold text-blue-600">{pumps?.length || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Dispensers</div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-1">
                <div className="p-1.5 bg-green-500 rounded-lg flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg sm:text-xl font-bold text-green-600">
                    {pumps?.filter((p: Pump) => p.status === EquipmentStatusEnum.ACTIVE).length || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Active Pumps</div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-1">
                <div className="p-1.5 bg-purple-500 rounded-lg flex-shrink-0">
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg sm:text-xl font-bold text-purple-600">
                    {pumps?.reduce((total: number, pump: Pump) => total + (pump.nozzles?.length || 0), 0) || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Nozzles</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      {pumpsLoading ? (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm sm:text-base text-muted-foreground">Loading pumps...</p>
          </div>
        </div>
      ) : !pumps || pumps.length === 0 ? (
        <Card className="border-2 border-dashed border-muted-foreground/25">
          <CardContent className="py-8 sm:py-12 text-center">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
              <Fuel className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold mb-2">No Pumps Configured</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-sm mx-auto">
              Set up fuel pumps to start managing your station's fuel dispensing equipment.
            </p>
            <PermissionGuard permission="manage_stations" roles={["owner","super_admin"]} fallback={<Button className="touch-manipulation" disabled><Plus className="w-4 h-4 mr-2"/>Add First Pump</Button>}>
              <Button onClick={() => setIsPumpDialogOpen(true)} className="touch-manipulation">
                <Plus className="w-4 h-4 mr-2" />
                Add First Pump
              </Button>
            </PermissionGuard>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pumps.map((pump: Pump) => (
            <PumpCard
              key={pump.id}
              pump={pump}
              onEdit={handleEditPump}
              onEditNozzle={handleEditNozzle}
              onAddNozzle={() => {
                setSelectedPump(pump);
                setIsNozzleDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AddPumpDialog
        open={isPumpDialogOpen}
        onOpenChange={setIsPumpDialogOpen}
        form={pumpForm}
        onFormChange={setPumpForm}
        onSubmit={handleCreatePump}
        isLoading={createPumpMutation.isPending}
      />

      <EditPumpDialog
        open={isEditPumpDialogOpen}
        onOpenChange={setIsEditPumpDialogOpen}
        pump={selectedPump}
        form={editPumpForm}
        onFormChange={setEditPumpForm}
        onSubmit={handleUpdatePump}
        isLoading={updatePumpMutation.isPending}
      />

      <AddNozzleDialog
        open={isNozzleDialogOpen}
        onOpenChange={setIsNozzleDialogOpen}
        pump={selectedPump}
        form={nozzleForm}
        onFormChange={setNozzleForm}
        onSubmit={handleCreateNozzle}
        isLoading={createNozzleMutation.isPending}
      />

      <EditNozzleDialog
        open={isEditNozzleDialogOpen}
        onOpenChange={setIsEditNozzleDialogOpen}
        nozzle={selectedNozzle}
        form={editNozzleForm}
        onFormChange={setEditNozzleForm}
        onSubmit={handleUpdateNozzle}
        isLoading={updateNozzleMutation.isPending}
      />
    </div>
  );
}
