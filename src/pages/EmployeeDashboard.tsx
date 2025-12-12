
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { fuelPriceService, FuelPrice } from '@/services/fuelPriceService';
import { settlementsService, DailySummary } from '@/services/settlementsService';
import { shiftService, dashboardAlertsService, Shift } from '@/services/tenderService';
import { Badge } from '@/components/ui/badge';
import { FuelPriceCard } from '@/components/dashboard/FuelPriceCard';
import { normalizeFuelType } from '@/hooks/useFuelPricesData';
import { Button } from '@/components/ui/button';
 import { Fuel, IndianRupee, Clock, Users, Play, Square, AlertCircle } from 'lucide-react';
import { safeToFixed } from '@/lib/format-utils';
import { EquipmentStatusEnum } from '@/core/enums';
import { TodayReadings } from '@/components/dashboard/TodayReadings';
import { useToast } from '@/hooks/use-toast';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fuelPrices, setFuelPrices] = useState<FuelPrice[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
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
        const today = new Date().toISOString().split('T')[0];
        const [pricesData, summaryData, shiftStatus] = await Promise.all([
          fuelPriceService.getFuelPrices(currentStation.id),
          settlementsService.getDailySummary(currentStation.id, today),
          dashboardAlertsService.getShiftStatus(),
        ]);

        setFuelPrices(pricesData || []);

        if (summaryData) {
          setDailySummary(summaryData);
        } else {
          console.warn('settlementsService returned no summary; fallback to null');
          setDailySummary(null);
        }

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
  }, [currentStation]);

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

      // Refresh summary (use stationId & today's date if available)
      const today = new Date().toISOString().split('T')[0];
      if (currentStation && currentStation.id) {
        const summaryData = await settlementsService.getDailySummary(currentStation.id, today);
        setDailySummary(summaryData);
      } else {
        const summaryData = await settlementsService.getDailySummary();
        setDailySummary(summaryData);
      }
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employee Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.name}</p>
          <p className="text-sm text-muted-foreground">Station: {currentStation.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {user?.role.charAt(0).toUpperCase() + user?.role.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Shift Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Shift Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeShift ? (
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="default" className="mb-2">Active Shift</Badge>
                <p className="text-sm text-muted-foreground">
                  Started at {activeShift.startTime} ({activeShift.shiftType})
                </p>
                {activeShift.totalSalesAmount > 0 && (
                  <p className="text-sm font-medium mt-1">
                    Sales so far: ₹{activeShift.totalSalesAmount.toLocaleString()}
                  </p>
                )}
              </div>
              <Button 
                variant="destructive" 
                onClick={handleEndShift}
                disabled={shiftLoading}
              >
                <Square className="h-4 w-4 mr-2" />
                {shiftLoading ? 'Ending...' : 'End Shift'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>No active shift</span>
              </div>
              <Button onClick={handleStartShift} disabled={shiftLoading}>
                <Play className="h-4 w-4 mr-2" />
                {shiftLoading ? 'Starting...' : 'Start Shift'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Fuel Prices</CardTitle>
              <Fuel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {/* Map fuelPrices to FuelPriceCard format */}
              {fuelPrices.length > 0 ? (
                <FuelPriceCard
                  prices={fuelPrices.reduce((acc: Record<string, number>, cur) => {
                    const type = normalizeFuelType(cur.fuelType);
                    acc[type] = Number(cur.price);
                    return acc;
                  }, {})}
                  isLoading={loading}
                  canSetPrices={false}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No fuel prices available</p>
              )}
            </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Collections</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dailySummary?.today ? (
              <>
                <div className="text-2xl font-bold">
                  ₹{(dailySummary.today.amount ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground space-y-1 mt-2">
                  <p>Cash: ₹{(dailySummary.today.cash ?? 0).toLocaleString()}</p>
                  <p>Online: ₹{(dailySummary.today.online ?? 0).toLocaleString()}</p>
                  <p>Credit: ₹{(dailySummary.today.credit ?? 0).toLocaleString()}</p>
                  <p className="font-medium pt-1">{dailySummary.today.readings ?? 0} readings</p>
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">₹0</div>
                <p className="text-xs text-muted-foreground">No data available</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Station Info</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-sm"><strong>Oil Company:</strong> {currentStation.oilCompany || 'Not specified'}</p>
              <p className="text-sm"><strong>Address:</strong> {currentStation.address || 'Not specified'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Readings */}
      <TodayReadings />

      {/* Pump Summary */}
      {dailySummary && dailySummary.pumps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pump Performance Today</CardTitle>
            <CardDescription>Sales by pump</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dailySummary.pumps.map((pump) => (
                <div key={pump.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{pump.name || `Pump ${pump.number}`}</p>
                      <Badge 
                        variant={pump.status === EquipmentStatusEnum.ACTIVE ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {pump.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {pump.activeNozzles}/{pump.nozzleCount} nozzles
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-lg font-bold">₹{(pump.today?.amount ?? 0).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">
                      {safeToFixed(pump.today?.litres ?? 0)} litres
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmployeeDashboard;
