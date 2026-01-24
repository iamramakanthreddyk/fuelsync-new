/**
 * Tank Inventory Management Page
 * 
 * Allows owners/managers to:
 * - View all tanks with real-time levels
 * - See "since last refill" tracking (sales since, last refill date/amount)
 * - Add new tanks with custom fuel names (MSD, HSM, XP 95)
 * - Record refills
 * - Correct/calibrate tank levels
 * - Get alerts for negative levels (missed refills)
 */

import { useState, useEffect } from 'react';
import { 
  useStations, 
  useTanks, 
  useCreateTank, 
  useRecordRefill, 
  useCalibrateTank, 
  useUpdateTank,
  useTankRefills
} from '@/hooks/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Fuel, 
  Plus, 
  Droplets, 
  AlertTriangle,
  Edit2,
  AlertCircle,
  Truck,
  Gauge,
} from 'lucide-react';
import { FUEL_TYPE_OPTIONS, type FuelType } from '@/lib/constants';
import { getFuelColors } from '@/lib/fuelColors';

interface TankData {
  id: string;
  stationId: string;
  fuelType: string;
  displayFuelName: string;
  name?: string;
  currentLevel: number;
  capacity: number;
  percentFull: number;
  status: string;
  statusMessage?: string;
  isNegative: boolean;
  lastRefill: {
    date: string | null;
    amount: number;
    levelAfter: number | null;
    salesSince: number;
  };
  alert?: {
    type: string;
    message: string;
    suggestedAction: string;
  };
}

export default function Inventory() {
  const { toast } = useToast();
  const { data: stationsResponse, isLoading: stationsLoading } = useStations();
  const stations = stationsResponse?.data || [];

  // Selected station
  const [selectedStationId, setSelectedStationId] = useState<string>('');

  // Dialogs
  const [showAddTank, setShowAddTank] = useState(false);
  const [showRefillDialog, setShowRefillDialog] = useState(false);
  const [showCalibrateDialog, setShowCalibrateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTank, setSelectedTank] = useState<TankData | null>(null);

  // Refill history filter
  const [refillDateFilter, setRefillDateFilter] = useState<'7days' | '30days' | 'all'>('30days');

  // Form states
  const [newTank, setNewTank] = useState({
    fuelType: '',
    displayFuelName: '',
    name: '',
    capacity: '',
    currentLevel: '',
  });

  const [refillData, setRefillData] = useState({
    litres: '',
    refillDate: new Date().toISOString().split('T')[0],
    refillTime: '',
    supplierName: '',
    vehicleNumber: '',
    costPerLitre: '',
    notes: '',
  });

  const [calibrateData, setCalibrateData] = useState({
    dipReading: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Mutations
  const createTankMutation = useCreateTank();
  const recordRefillMutation = useRecordRefill();
  const calibrateMutation = useCalibrateTank();
  const updateTankMutation = useUpdateTank();

  // Tanks query
  const { data: tanksResponse, isLoading: tanksLoading, refetch: refetchTanks } = useTanks(selectedStationId);
  
  // Transform API Tank data to TankData with computed properties
  // Handle both camelCase and snake_case from API
  const tanks: TankData[] = (tanksResponse?.data || []).map((tank: any) => {
    const currentLevel = tank.currentLevel ?? tank.current_level ?? 0;
    const capacity = tank.capacity ?? 1;
    const percentFull = Math.round((currentLevel / capacity) * 100);
    const isNegative = currentLevel < 0;
    
    // Compute status based on level
    let status = 'normal';
    if (isNegative) {
      status = 'negative';
    } else if (percentFull <= 0) {
      status = 'empty';
    } else if (percentFull <= 10) {
      status = 'critical';
    } else if (percentFull <= 20) {
      status = 'low';
    } else if (percentFull > 100) {
      status = 'overflow';
    }

    // Compute "since last refill" data from nested lastRefill object
    // API returns: { lastRefill: { date, amount, levelAfter, salesSince } }
    const lastRefillObj = tank.lastRefill || {};
    const levelAfterLastRefill = lastRefillObj.levelAfter ?? lastRefillObj.level_after ?? null;
    const lastRefillDate = lastRefillObj.date ?? null;
    const lastRefillAmount = lastRefillObj.amount ?? 0;
    const salesSince = lastRefillObj.salesSince ?? (levelAfterLastRefill !== null 
      ? Math.max(0, levelAfterLastRefill - currentLevel) 
      : 0);

    // Build alert if negative
    const alert = isNegative ? {
      type: 'negative',
      message: `Level is ${Math.abs(currentLevel).toLocaleString()}L below zero - missing refill?`,
      suggestedAction: 'Record the missing refill to correct the level',
    } : undefined;

    return {
      id: tank.id,
      stationId: tank.stationId ?? tank.station_id,
      fuelType: tank.fuelType ?? tank.fuel_type,
      displayFuelName: tank.displayFuelName ?? tank.display_fuel_name ?? tank.fuelType ?? tank.fuel_type,
      name: tank.name,
      currentLevel,
      capacity,
      percentFull,
      status,
      isNegative,
      lastRefill: {
        date: lastRefillDate,
        amount: lastRefillAmount,
        levelAfter: levelAfterLastRefill,
        salesSince,
      },
      alert,
    };
  });

  // Auto-select first station using useEffect
  useEffect(() => {
    if (stations.length > 0 && !selectedStationId) {
      setSelectedStationId(stations[0].id);
    }
  }, [stations]);

  // Handle add tank
  const handleAddTank = async () => {
    if (!newTank.fuelType || !newTank.capacity) {
      toast({ title: 'Error', description: 'Please fill in required fields', variant: 'destructive' });
      return;
    }

    try {
      await createTankMutation.mutateAsync({
        stationId: selectedStationId,
        data: {
          fuelType: newTank.fuelType as FuelType,
          displayFuelName: newTank.displayFuelName || undefined,
          name: newTank.name || undefined,
          capacity: parseFloat(newTank.capacity),
          currentLevel: parseFloat(newTank.currentLevel) || 0,
        },
      });
      toast({ title: 'Success', description: 'Tank added successfully' });
      setShowAddTank(false);
      setNewTank({ fuelType: '', displayFuelName: '', name: '', capacity: '', currentLevel: '' });
      refetchTanks();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to add tank', variant: 'destructive' });
    }
  };

  // Handle refill
  const handleRefill = async () => {
    if (!selectedTank || !refillData.litres) {
      toast({ title: 'Error', description: 'Please enter litres', variant: 'destructive' });
      return;
    }

    try {
      await recordRefillMutation.mutateAsync({
        tankId: selectedTank.id,
        data: {
          litres: parseFloat(refillData.litres),
          refillDate: refillData.refillDate,
          refillTime: refillData.refillTime || undefined,
          supplierName: refillData.supplierName || undefined,
          vehicleNumber: refillData.vehicleNumber || undefined,
          costPerLitre: refillData.costPerLitre ? parseFloat(refillData.costPerLitre) : undefined,
          notes: refillData.notes || undefined,
        },
      });
      toast({ title: 'Success', description: `Refill recorded: +${refillData.litres}L`, variant: 'default' });
      setShowRefillDialog(false);
      setRefillData({ litres: '', refillDate: new Date().toISOString().split('T')[0], refillTime: '', supplierName: '', vehicleNumber: '', costPerLitre: '', notes: '' });
      refetchTanks();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to record refill', variant: 'destructive' });
    }
  };

  // Handle calibrate
  const handleCalibrate = async () => {
    if (!selectedTank || !calibrateData.dipReading) {
      toast({ title: 'Error', description: 'Please enter dip reading', variant: 'destructive' });
      return;
    }

    try {
      await calibrateMutation.mutateAsync({
        tankId: selectedTank.id,
        dipReading: parseFloat(calibrateData.dipReading),
        date: calibrateData.date,
        notes: calibrateData.notes || undefined,
      });
      toast({ title: 'Success', description: 'Tank calibrated successfully' });
      setShowCalibrateDialog(false);
      setCalibrateData({ dipReading: '', date: new Date().toISOString().split('T')[0], notes: '' });
      refetchTanks();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to calibrate', variant: 'destructive' });
    }
  };

  // Helper to get date range for filters
  const getDateRange = () => {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    if (refillDateFilter === '7days') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (refillDateFilter === '30days') {
      startDate.setDate(startDate.getDate() - 30);
    } else {
      startDate.setFullYear(2000); // Get all refills
    }
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate
    };
  };

  // Fetch refills for selected tank
  const dateRange = getDateRange();
  const { data: refillsResponse, isLoading: refillsLoading } = useTankRefills(
    selectedTank?.id || '',
    selectedTank ? {
      startDate: refillDateFilter === 'all' ? undefined : dateRange.startDate,
      endDate: refillDateFilter === 'all' ? undefined : dateRange.endDate,
      limit: 50
    } : undefined
  );
  
  const refills = refillsResponse?.data || [];
  
  // Calculate refill stats
  const refillStats = {
    totalRefills: refills.length,
    totalAmount: refills.reduce((sum, r: any) => sum + (r.litres || r.amount || 0), 0),
    averageAmount: refills.length > 0 ? Math.round(refills.reduce((sum, r: any) => sum + (r.litres || r.amount || 0), 0) / refills.length * 10) / 10 : 0,
    lastRefillDate: refills.length > 0 ? new Date(refills[0]?.refillDate || refills[0]?.created_at).toLocaleDateString() : 'N/A'
  };
  const renderTankCard = (tank: TankData) => {
    const fuelColors = getFuelColors(tank.fuelType);
    const isLow = tank.percentFull <= 20;
    const isCritical = tank.percentFull <= 10;
    const isSelected = selectedTank?.id === tank.id;
    
    return (
      <Card 
        key={tank.id} 
        onClick={() => setSelectedTank(tank)}
        className={`overflow-hidden transition-all cursor-pointer shadow-md hover:shadow-xl ${
          isSelected ? 'ring-2 ring-blue-500 shadow-xl' : ''
        } ${tank.isNegative ? 'border-2 border-red-500 bg-red-50' : 'border border-slate-200'}`}
      >
        {/* Status header - Modern and Clean */}
        <div className={`px-4 sm:px-5 py-3 sm:py-4 flex items-start sm:items-center justify-between gap-3 bg-gradient-to-r ${fuelColors.bg} border-b-2 ${fuelColors.border}`}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`p-2.5 rounded-xl flex-shrink-0 bg-white/60 backdrop-blur-sm`}>
              <Droplets className={`w-5 h-5 sm:w-6 sm:h-6 ${fuelColors.text}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`font-bold text-base sm:text-lg ${fuelColors.text} truncate`}>
                {tank.displayFuelName}
              </div>
              {tank.name && (
                <div className={`text-xs sm:text-sm ${fuelColors.text} opacity-70 truncate`}>
                  {tank.name}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`px-3 py-1.5 rounded-lg font-bold text-sm ${fuelColors.bg} ${fuelColors.text} border-2 ${fuelColors.border}`}>
              {tank.percentFull}%
            </div>
          </div>
        </div>

        <CardContent className="p-4 sm:p-5 space-y-4 sm:space-y-5">
          {/* Alert for negative level */}
          {tank.isNegative && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <div className="font-semibold">Critical: Negative Level</div>
                <div className="text-xs mt-1">{Math.abs(tank.currentLevel).toLocaleString()}L below zero</div>
              </div>
            </div>
          )}

          {/* Alert for low level */}
          {!tank.isNegative && isLow && (
            <div className={`${isCritical ? 'bg-orange-50 border-orange-300' : 'bg-yellow-50 border-yellow-300'} border rounded-lg p-3 flex gap-2`}>
              <AlertCircle className={`w-5 h-5 ${isCritical ? 'text-orange-600' : 'text-yellow-600'} flex-shrink-0 mt-0.5`} />
              <div className={`text-sm ${isCritical ? 'text-orange-800' : 'text-yellow-800'}`}>
                <div className="font-semibold">{isCritical ? 'Critical Level' : 'Low Fuel'}</div>
                <div className="text-xs mt-1">
                  {isCritical ? 'Immediate refill needed' : 'Schedule refill soon'}
                </div>
              </div>
            </div>
          )}

          {/* Fuel Level Indicator - Clean Dashboard Style */}
          <div className="bg-white rounded-xl p-4 sm:p-5 space-y-4 border border-slate-200/80 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Fuel Level</h3>
            </div>

            {/* Main Content - Two column layout */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left: Current Level (Large Display) */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase">Current Reading</div>
                <div className={`flex items-baseline gap-1 ${tank.isNegative ? 'text-red-600' : fuelColors.text}`}>
                  <div className={`text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold leading-tight break-words`}>
                    {tank.currentLevel.toLocaleString()}
                  </div>
                  <div className="text-sm sm:text-base font-semibold">L</div>
                </div>
              </div>

              {/* Right: Percentage Badge */}
              <div className={`rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center border-2 ${
                isCritical ? 'bg-orange-50 border-orange-300' :
                isLow ? 'bg-yellow-50 border-yellow-300' :
                'bg-green-50 border-green-300'
              }`}>
                <div className="text-[10px] sm:text-xs font-semibold text-slate-600 mb-1">Fill</div>
                <div className={`text-xl xs:text-2xl sm:text-3xl font-bold ${
                  isCritical ? 'text-orange-600' :
                  isLow ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {tank.percentFull}%
                </div>
              </div>
            </div>

            {/* Capacity Info Bar */}
            <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between border border-slate-200/50">
              <div>
                <div className="text-[10px] sm:text-xs text-slate-600 font-semibold">Tank Capacity</div>
                <div className={`text-sm sm:text-base font-bold break-words ${fuelColors.text}`}>{tank.capacity.toLocaleString()}L</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] sm:text-xs text-slate-600 font-semibold">Free Space</div>
                <div className="text-sm sm:text-base font-bold break-words text-slate-700">{(tank.capacity - tank.currentLevel).toLocaleString()}L</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden shadow-sm">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    tank.isNegative ? 'bg-red-500' :
                    isCritical ? 'bg-orange-500' :
                    isLow ? 'bg-yellow-500' :
                    fuelColors.dot
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, tank.percentFull))}%` }}
                />
              </div>
              
              {/* Status indicators */}
              <div className="flex gap-3 text-xs justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${fuelColors.dot} opacity-40`}></div>
                  <span className="text-slate-600">Empty</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span className="text-slate-600">Low</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${fuelColors.dot}`}></div>
                  <span className="text-slate-600">Good</span>
                </div>
              </div>
            </div>
          </div>

          {/* Last refill info - Modern card style */}
          {tank.lastRefill.date && (
            <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 rounded-xl p-3.5 sm:p-4 space-y-3 border border-blue-200/60 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-base">🔄</span>
                <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">Recent Refill</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white/50 rounded-lg p-2.5">
                  <span className="text-xs sm:text-sm font-semibold text-slate-700">Added</span>
                  <span className={`font-bold text-base sm:text-lg ${fuelColors.text}`}>+{tank.lastRefill.amount.toLocaleString()}L</span>
                </div>
                <div className="flex items-center justify-between bg-white/50 rounded-lg p-2.5">
                  <span className="text-xs sm:text-sm font-semibold text-slate-700">Sold Since</span>
                  <span className="font-bold text-base sm:text-lg text-amber-600">-{tank.lastRefill.salesSince.toLocaleString()}L</span>
                </div>
                <div className="text-xs font-medium text-blue-600 pt-2 border-t border-blue-100/50 flex items-center gap-1">
                  <span>📅</span>
                  {new Date(tank.lastRefill.date).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons - Modern and Accessible */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200/60">
            <Button 
              size="sm"
              className="w-full bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:from-emerald-700 active:to-emerald-800 text-white shadow-md hover:shadow-lg transition-all duration-200 font-bold text-xs sm:text-sm py-2.5 h-auto rounded-lg border border-emerald-700/30"
              title="Record Fuel Refill"
              onClick={() => {
                setSelectedTank(tank);
                setShowRefillDialog(true);
              }}
            >
              <Truck className="w-4 h-4 mr-1.5" />
              <span>Refill</span>
            </Button>
            <Button 
              size="sm"
              className="w-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:from-blue-700 active:to-blue-800 text-white shadow-md hover:shadow-lg transition-all duration-200 font-bold text-xs sm:text-sm py-2.5 h-auto rounded-lg border border-blue-700/30"
              title="Calibrate Tank Level"
              onClick={() => {
                setSelectedTank(tank);
                setCalibrateData({ ...calibrateData, dipReading: tank.currentLevel.toString() });
                setShowCalibrateDialog(true);
              }}
            >
              <Gauge className="w-4 h-4 mr-1.5" />
              <span>Calibrate</span>
            </Button>
            <Button 
              size="sm"
              className="w-full bg-gradient-to-br from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 active:from-slate-700 active:to-slate-800 text-white shadow-md hover:shadow-lg transition-all duration-200 font-bold text-xs sm:text-sm py-2.5 h-auto rounded-lg border border-slate-700/30"
              title="Edit Tank Details"
              onClick={() => {
                setSelectedTank(tank);
                setShowEditDialog(true);
              }}
            >
              <Edit2 className="w-4 h-4 mr-1.5" />
              <span>Edit</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (stationsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading stations...</div>
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Fuel className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Stations Found</h3>
            <p className="text-muted-foreground">Add a station first to manage tank inventory.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="w-full px-4 py-4 sm:px-6">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-slate-900">
                <Fuel className="w-6 h-6 text-blue-600" />
                Tank Inventory
              </h1>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedStationId} onValueChange={setSelectedStationId}>
                <SelectTrigger className="flex-1 sm:flex-none sm:w-[220px] border-slate-300">
                  <SelectValue placeholder="Select station" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={() => setShowAddTank(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transition-all font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Tank
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tanks grid */}
      <div className="px-4 py-6 sm:px-6">
        {tanksLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-slate-600">Loading tanks...</p>
          </div>
        ) : tanks.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 p-8 text-center">
            <Droplets className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Tanks Configured</h3>
            <p className="text-slate-600 mb-6">Add your first tank to start tracking inventory.</p>
            <Button 
              onClick={() => setShowAddTank(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tank
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {tanks.map(renderTankCard)}
          </div>
        )}

        {/* Refill History & Stats */}
        {selectedTank && (
          <div className="mt-8 pt-8 border-t border-slate-200">
            <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-teal-600 rounded-lg">
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Refill History & Stats</h3>
                      <p className="text-xs text-slate-600">{selectedTank.displayFuelName} Tank</p>
                    </div>
                  </div>
                  
                  {/* Date Filter */}
                  <Select value={refillDateFilter} onValueChange={(v: any) => setRefillDateFilter(v)}>
                    <SelectTrigger className="w-full sm:w-[160px] border-teal-300 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Stats Grid - Responsive */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  <div className="bg-white rounded-lg sm:rounded-xl p-2.5 sm:p-4 border border-teal-100 shadow-sm">
                    <p className="text-[9px] sm:text-xs text-slate-600 font-bold uppercase tracking-tight mb-2 line-clamp-2 h-8 sm:h-auto">Total Refills</p>
                    <p className="text-xl sm:text-3xl font-bold text-teal-600">{refillStats.totalRefills}</p>
                  </div>
                  <div className="bg-white rounded-lg sm:rounded-xl p-2.5 sm:p-4 border border-teal-100 shadow-sm">
                    <p className="text-[9px] sm:text-xs text-slate-600 font-bold uppercase tracking-tight mb-2 line-clamp-2 h-8 sm:h-auto">Total Liters</p>
                    <p className="text-lg sm:text-3xl font-bold text-cyan-600 break-words">
                      {refillStats.totalAmount >= 1000 
                        ? (refillStats.totalAmount / 1000).toFixed(1) + 'k'
                        : refillStats.totalAmount.toLocaleString()
                      }<span className="text-xs sm:text-sm font-normal">L</span>
                    </p>
                  </div>
                  <div className="bg-white rounded-lg sm:rounded-xl p-2.5 sm:p-4 border border-teal-100 shadow-sm">
                    <p className="text-[9px] sm:text-xs text-slate-600 font-bold uppercase tracking-tight mb-2 line-clamp-2 h-8 sm:h-auto">Avg/Refill</p>
                    <p className="text-lg sm:text-3xl font-bold text-blue-600 break-words">
                      {refillStats.averageAmount >= 1000 
                        ? (refillStats.averageAmount / 1000).toFixed(1) + 'k'
                        : refillStats.averageAmount.toLocaleString()
                      }<span className="text-xs sm:text-sm font-normal">L</span>
                    </p>
                  </div>
                  <div className="bg-white rounded-lg sm:rounded-xl p-2.5 sm:p-4 border border-teal-100 shadow-sm">
                    <p className="text-[9px] sm:text-xs text-slate-600 font-bold uppercase tracking-tight mb-2 line-clamp-2 h-8 sm:h-auto">Last Refill</p>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 break-words">{refillStats.lastRefillDate}</p>
                  </div>
                </div>

                {/* Refill History Table - Desktop & Mobile */}
                {refillsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-slate-600 text-sm">Loading refill history...</div>
                  </div>
                ) : refills.length === 0 ? (
                  <div className="text-center py-8 border-t border-teal-100">
                    <Droplets className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-600 text-sm">No refills recorded in this period</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Recent Refills</h4>
                    
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-teal-200 bg-teal-100/50">
                            <th className="text-left p-3 font-semibold text-slate-700">Date</th>
                            <th className="text-right p-3 font-semibold text-slate-700">Amount</th>
                            <th className="text-right p-3 font-semibold text-slate-700">Before</th>
                            <th className="text-right p-3 font-semibold text-slate-700">After</th>
                            {refills[0]?.supplierName && <th className="text-left p-3 font-semibold text-slate-700">Supplier</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {refills.map((refill: any, idx: number) => (
                            <tr key={idx} className="border-b border-teal-100 hover:bg-white/60 transition-colors">
                              <td className="p-3 text-slate-700 font-medium">
                                {new Date(refill.refillDate || refill.createdAt).toLocaleDateString()}
                              </td>
                              <td className="text-right p-3 font-bold text-emerald-600">
                                +{(refill.litres || refill.amount || 0).toLocaleString()}L
                              </td>
                              <td className="text-right p-3 text-slate-600">
                                {refill.levelBefore !== null && refill.levelBefore !== undefined 
                                  ? `${Number(refill.levelBefore || refill.level_before).toLocaleString()}L`
                                  : '--'
                                }
                              </td>
                              <td className="text-right p-3 font-semibold text-teal-600">
                                {refill.levelAfter !== null && refill.levelAfter !== undefined
                                  ? `${Number(refill.levelAfter || refill.level_after).toLocaleString()}L`
                                  : '--'
                                }
                              </td>
                              {refills[0]?.supplierName && <td className="p-3 text-slate-700">{refill.supplierName || '-'}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-2 sm:space-y-3">
                      {refills.map((refill: any, idx: number) => {
                        // Format numbers for better mobile display
                        const formatNum = (val: any) => {
                          if (!val && val !== 0) return '--';
                          const num = Number(val);
                          if (num >= 1000) {
                            return (num / 1000).toFixed(1) + 'k';
                          }
                          return num.toLocaleString();
                        };
                        
                        return (
                          <div key={idx} className="bg-white border border-teal-200 rounded-lg p-2.5 sm:p-3 space-y-2">
                            {/* Date and Amount Header - Compact */}
                            <div className="flex items-center justify-between gap-2 pb-2 border-b border-teal-100">
                              <div className="min-w-0">
                                <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-tight mb-0.5">Date</p>
                                <p className="font-bold text-slate-900 text-xs sm:text-sm">
                                  {new Date(refill.refillDate || refill.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-[9px] sm:text-[10px] text-emerald-600 font-bold uppercase tracking-tight mb-0.5">Added</p>
                                <p className="font-bold text-emerald-600 text-sm sm:text-base whitespace-nowrap">
                                  +{formatNum(refill.litres || refill.amount)}L
                                </p>
                              </div>
                            </div>

                            {/* Level Before and After - Side by Side */}
                            <div className="grid grid-cols-2 gap-1.5">
                              <div className="bg-blue-50 rounded p-2 border border-blue-100 min-w-0">
                                <p className="text-[9px] sm:text-[10px] text-blue-700 font-bold uppercase tracking-tight mb-0.5 leading-tight">Level<br/>Before</p>
                                <p className="font-bold text-blue-700 text-sm sm:text-base break-words">
                                  {refill.levelBefore !== null && refill.levelBefore !== undefined 
                                    ? `${formatNum(refill.levelBefore || refill.level_before)}L`
                                    : '--L'
                                  }
                                </p>
                              </div>
                              <div className="bg-teal-50 rounded p-2 border border-teal-100 min-w-0">
                                <p className="text-[9px] sm:text-[10px] text-teal-700 font-bold uppercase tracking-tight mb-0.5 leading-tight">Level<br/>After</p>
                                <p className="font-bold text-teal-700 text-sm sm:text-base break-words">
                                  {refill.levelAfter !== null && refill.levelAfter !== undefined
                                    ? `${formatNum(refill.levelAfter || refill.level_after)}L`
                                    : '--L'
                                  }
                                </p>
                              </div>
                            </div>

                            {/* Supplier if available */}
                            {refill.supplierName && (
                              <div className="pt-1.5 border-t border-teal-100 min-w-0">
                                <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-tight mb-0.5">Supplier</p>
                                <p className="text-xs sm:text-sm text-slate-700 truncate">{refill.supplierName}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <Dialog open={showAddTank} onOpenChange={setShowAddTank}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Tank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-semibold">Fuel Type *</Label>
              <Select value={newTank.fuelType} onValueChange={(v) => setNewTank({ ...newTank, fuelType: v })}>
                <SelectTrigger className="text-base">
                  <SelectValue placeholder="Select fuel type" />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_TYPE_OPTIONS.map((fuel) => (
                    <SelectItem key={fuel.value} value={fuel.value}>
                      {fuel.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Display Name (Custom)</Label>
              <Input 
                className="text-base"
                placeholder="e.g., MSD, HSM, XP 95"
                value={newTank.displayFuelName}
                onChange={(e) => setNewTank({ ...newTank, displayFuelName: e.target.value })}
              />
              <p className="text-xs text-slate-600">
                Custom name shown in UI
              </p>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Tank Name (Optional)</Label>
              <Input 
                className="text-base"
                placeholder="e.g., Underground Tank 1"
                value={newTank.name}
                onChange={(e) => setNewTank({ ...newTank, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold">Capacity (L) *</Label>
                <Input 
                  className="text-base"
                  type="number"
                  placeholder="e.g., 20000"
                  value={newTank.capacity}
                  onChange={(e) => setNewTank({ ...newTank, capacity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Current Level (L)</Label>
                <Input 
                  className="text-base"
                  type="number"
                  placeholder="e.g., 15000"
                  value={newTank.currentLevel}
                  onChange={(e) => setNewTank({ ...newTank, currentLevel: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowAddTank(false)} className="w-full sm:w-auto border-slate-300 hover:bg-slate-50">
              Cancel
            </Button>
            <Button onClick={handleAddTank} disabled={createTankMutation.isPending} className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transition-all">
              {createTankMutation.isPending ? 'Adding...' : 'Add Tank'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refill Dialog */}
      <Dialog open={showRefillDialog} onOpenChange={setShowRefillDialog}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Record Refill</DialogTitle>
            {selectedTank && (
              <p className="text-sm text-slate-600 mt-1">{selectedTank?.displayFuelName}</p>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedTank && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-2">
                <div className="flex justify-between text-blue-900">
                  <span>Current level:</span>
                  <span className="font-semibold">{selectedTank?.currentLevel.toLocaleString()}L</span>
                </div>
                <div className="flex justify-between text-blue-900">
                  <span>Capacity:</span>
                  <span className="font-semibold">{selectedTank?.capacity.toLocaleString()}L</span>
                </div>
                <div className="flex justify-between text-blue-900">
                  <span>Space available:</span>
                  <span className="font-semibold">
                    {(selectedTank?.capacity! - selectedTank?.currentLevel!).toLocaleString()}L
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="font-semibold">Litres Added *</Label>
              <Input 
                className="text-base"
                type="number"
                placeholder="e.g., 5000"
                value={refillData.litres}
                onChange={(e) => setRefillData({ ...refillData, litres: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Refill Date</Label>
              <Input 
                className="text-base"
                type="date"
                value={refillData.refillDate}
                onChange={(e) => setRefillData({ ...refillData, refillDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Refill Time (Optional)</Label>
              <Input 
                className="text-base"
                type="time"
                value={refillData.refillTime || ''}
                onChange={(e) => setRefillData({ ...refillData, refillTime: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold text-sm">Supplier</Label>
                <Input 
                  className="text-base"
                  placeholder="e.g., IOCL"
                  value={refillData.supplierName}
                  onChange={(e) => setRefillData({ ...refillData, supplierName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-sm">Vehicle #</Label>
                <Input 
                  className="text-base"
                  placeholder="AP09AB1234"
                  value={refillData.vehicleNumber}
                  onChange={(e) => setRefillData({ ...refillData, vehicleNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Cost per Litre (₹)</Label>
              <Input 
                className="text-base"
                type="number"
                step="0.01"
                placeholder="e.g., 85.50"
                value={refillData.costPerLitre}
                onChange={(e) => setRefillData({ ...refillData, costPerLitre: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowRefillDialog(false)} className="w-full sm:w-auto border-slate-300 hover:bg-slate-50">
              Cancel
            </Button>
            <Button onClick={handleRefill} disabled={recordRefillMutation.isPending} className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transition-all">
              {recordRefillMutation.isPending ? 'Recording...' : 'Record Refill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calibrate Dialog */}
      <Dialog open={showCalibrateDialog} onOpenChange={setShowCalibrateDialog}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Calibrate Tank</DialogTitle>
            <p className="text-sm text-slate-600 mt-1">Enter actual dip reading to correct system level</p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedTank && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-amber-900">
                  <span>System level:</span>
                  <span className="font-semibold">{selectedTank?.currentLevel.toLocaleString()}L</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="font-semibold">Actual Dip Reading (L) *</Label>
              <Input 
                className="text-base"
                type="number"
                placeholder="e.g., 14500"
                value={calibrateData.dipReading}
                onChange={(e) => setCalibrateData({ ...calibrateData, dipReading: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Date</Label>
              <Input 
                className="text-base"
                type="date"
                value={calibrateData.date}
                onChange={(e) => setCalibrateData({ ...calibrateData, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Notes</Label>
              <Input 
                className="text-base"
                placeholder="Reason for calibration..."
                value={calibrateData.notes}
                onChange={(e) => setCalibrateData({ ...calibrateData, notes: e.target.value })}
              />
            </div>

            {selectedTank && calibrateData.dipReading && (
              <div className={`rounded-lg p-3 text-sm ${
                parseFloat(calibrateData.dipReading) - selectedTank?.currentLevel! > 0
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className={`font-semibold ${
                  parseFloat(calibrateData.dipReading) - selectedTank?.currentLevel! > 0
                    ? 'text-green-900'
                    : 'text-red-900'
                }`}>
                  Adjustment: {parseFloat(calibrateData.dipReading) - selectedTank?.currentLevel! > 0 ? '+' : ''}
                  {(parseFloat(calibrateData.dipReading) - selectedTank?.currentLevel!).toLocaleString()}L
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCalibrateDialog(false)} className="w-full sm:w-auto border-slate-300 hover:bg-slate-50">
              Cancel
            </Button>
            <Button onClick={handleCalibrate} disabled={calibrateMutation.isPending} className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transition-all">
              {calibrateMutation.isPending ? 'Calibrating...' : 'Calibrate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tank Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Tank</DialogTitle>
          </DialogHeader>
          {selectedTank && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p className="text-slate-900 font-semibold">{selectedTank?.displayFuelName}</p>
                <p className="text-slate-600 text-xs mt-1">ID: {selectedTank?.id}</p>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Display Name</Label>
                <Input 
                  className="text-base"
                  placeholder="e.g., MSD, HSM, XP 95"
                  defaultValue={selectedTank?.displayFuelName}
                  id="edit-display-name"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Tank Name</Label>
                <Input 
                  className="text-base"
                  placeholder="e.g., Underground Tank 1"
                  defaultValue={selectedTank?.name || ''}
                  id="edit-tank-name"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Capacity (L)</Label>
                <Input 
                  className="text-base"
                  type="number"
                  defaultValue={selectedTank?.capacity}
                  id="edit-capacity"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="w-full sm:w-auto border-slate-300 hover:bg-slate-50">
              Cancel
            </Button>
            <Button 
              disabled={updateTankMutation.isPending}
              onClick={async () => {
                if (!selectedTank) return;
                const displayName = (document.getElementById('edit-display-name') as HTMLInputElement)?.value;
                const name = (document.getElementById('edit-tank-name') as HTMLInputElement)?.value;
                const capacity = (document.getElementById('edit-capacity') as HTMLInputElement)?.value;

                try {
                  await updateTankMutation.mutateAsync({
                    tankId: selectedTank.id,
                    data: {
                      displayFuelName: displayName || undefined,
                      name: name || undefined,
                      capacity: capacity ? parseFloat(capacity) : undefined,
                    },
                  });
                  toast({ title: 'Success', description: 'Tank updated successfully' });
                  setShowEditDialog(false);
                  refetchTanks();
                } catch (error: any) {
                  toast({ title: 'Error', description: error.message, variant: 'destructive' });
                }
              }}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transition-all"
            >
              {updateTankMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
