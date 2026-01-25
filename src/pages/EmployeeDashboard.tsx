
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { fuelPriceService, FuelPrice } from '@/services/fuelPriceService';
import { shiftService, dashboardAlertsService, Shift } from '@/services/shiftService';
import { Badge } from '@/components/ui/badge';
import { FuelPriceCard } from '@/components/dashboard/FuelPriceCard';
import { normalizeFuelType } from '@/hooks/useFuelPricesData';
import { Button } from '@/components/ui/button';
 import { Fuel, Clock, Users, Play, Square, AlertCircle } from 'lucide-react';
import { safeToFixed } from '@/lib/format-utils';
import { TodayReadings } from '@/components/dashboard/TodayReadings';
import { useToast } from '@/hooks/use-toast';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fuelPrices, setFuelPrices] = useState<FuelPrice[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [shiftLoading, setShiftLoading] = useState(false);

  // Get the first station for this employee
  const currentStation = user?.stations?.[0];

  useEffect(() => {
    const fetchData = async () => {
      if (!currentStation) {
        setLoading(false);
        return;
      }
      try {
        const [pricesData, shiftStatus] = await Promise.all([
          fuelPriceService.getFuelPrices(currentStation.id),
          dashboardAlertsService.getShiftStatus(),
        ]);

        setFuelPrices(pricesData || []);
        setActiveShift((shiftStatus && (shiftStatus as any).myActiveShift) || null);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast({ title: "Error", description: 'Error fetching dashboard data: ' + (error instanceof Error ? error.message : String(error)), variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    if (currentStation && currentStation.id) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [currentStation, toast]);

  const handleStartShift = async () => {
    if (!currentStation) return;
    
    setShiftLoading(true);
    try {
      const shift = await shiftService.startShift({
        stationId: currentStation.id
      });
      setActiveShift(shift);
      toast({ title: "Success", description: "Shift started successfully", variant: "success" });
    } catch (error: unknown) {
      console.error('Failed to start shift:', error);
      toast({ title: "Error", description: error instanceof Error ? error.message : 'Failed to start shift', variant: "destructive" });
    } finally {
      setShiftLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeShift) return;

    setShiftLoading(true);
    try {
      // For testing - use a simple prompt. In production, this should be a proper form
      const cashCollected = prompt('Enter cash collected amount (₹):', '1500');
      if (cashCollected === null || cashCollected.trim() === '') {
        setShiftLoading(false);
        return;
      }

      const amount = parseFloat(cashCollected);
      if (isNaN(amount) || amount < 0) {
        toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
        setShiftLoading(false);
        return;
      }

      await shiftService.endShift(activeShift.id, {
        cashCollected: amount,
      });

      toast({ title: "Success", description: "Shift ended successfully.", variant: "success" });
      setActiveShift(null);
    } catch (error: unknown) {
      console.error('Failed to end shift:', error);
      toast({ title: "Error", description: error instanceof Error ? error.message : 'Failed to end shift', variant: "destructive" });
    } finally {
      setShiftLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentStation) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto p-4 md:p-8 space-y-8">
        
        {/* Header Section */}
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">Good to see you, {user?.name}! 👋</h1>
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <p className="text-lg text-muted-foreground">📍 {currentStation.name}</p>
            <Badge variant="secondary" className="w-fit flex items-center gap-2 px-3 py-1.5">
              <Users className="h-3.5 w-3.5" />
              {user?.role.charAt(0).toUpperCase() + user?.role.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Shift Management - Prominent Card */}
        <div className="relative">
          {activeShift ? (
            <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 shadow-lg">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600 hover:bg-green-700 flex items-center gap-1.5 px-3 py-1.5">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                        Active Shift
                      </Badge>
                      <span className="text-sm font-medium text-muted-foreground">{activeShift.shiftType}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      ⏱️ Started at {activeShift.startTime}
                    </p>
                    {activeShift.totalSalesAmount > 0 && (
                      <p className="text-xl font-bold text-green-600">
                        ₹{activeShift.totalSalesAmount.toLocaleString()} in sales
                      </p>
                    )}
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={handleEndShift}
                    disabled={shiftLoading}
                    className="gap-2 h-12 px-6 text-base md:w-auto w-full"
                  >
                    <Square className="h-4 w-4" />
                    {shiftLoading ? 'Ending...' : 'End Shift'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-orange-500/20 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 shadow-lg">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3 text-lg">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-600">No active shift yet</span>
                  </div>
                  <Button 
                    onClick={handleStartShift} 
                    disabled={shiftLoading}
                    className="gap-2 h-12 px-6 text-base bg-blue-600 hover:bg-blue-700 md:w-auto w-full"
                  >
                    <Play className="h-4 w-4" />
                    {shiftLoading ? 'Starting...' : 'Start Shift'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Stats Grid - Redesigned */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          
          {/* Station Info */}
          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 shadow-md border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <span className="text-2xl">🏢</span>
                Station Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Oil Company</p>
                <p className="text-base font-medium text-foreground mt-1">{currentStation.oilCompany || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</p>
                <p className="text-base font-medium text-foreground mt-1">{currentStation.address || 'Not specified'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fuel Prices Section */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="text-2xl">⛽</div>
            <h2 className="text-2xl font-bold text-foreground">Current Fuel Prices</h2>
          </div>
          <Card className="shadow-md border-0">
            <CardContent className="pt-6">
              {fuelPrices.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {fuelPrices.map((fuel) => {
                    const fuelType = normalizeFuelType(fuel.fuelType);
                    const icons: Record<string, string> = {
                      'PETROL': '🔴',
                      'DIESEL': '🟢',
                      'CNG': '🔵',
                      'LPG': '🟡'
                    };
                    return (
                      <div key={fuel.id} className="p-4 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600 hover:shadow-md transition-shadow">
                        <p className="text-sm text-muted-foreground mb-1 font-medium">{icons[fuelType]} {fuelType}</p>
                        <p className="text-2xl font-bold text-foreground">₹{Number(fuel.price).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground mt-1">per litre</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No fuel prices available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Today's Readings */}
        {/* <TodayReadings /> */}

      </div>
    </div>
  );
};

export default EmployeeDashboard;
