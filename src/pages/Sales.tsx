import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
// Badge not used in this file
import { useToast } from "@/hooks/use-toast";
import { apiClient } from '@/lib/api-client';
import { Plus, ChartBar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSalesData } from "@/hooks/useSalesData";
import { usePumpsData } from "@/hooks/usePumpsData";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useAuth } from "@/hooks/useAuth";
import { useSalesManagement } from "@/hooks/useSalesManagement";
import { useActiveShift, usePriceCheck } from '@/hooks/api/index';
import { SalesCharts } from "@/components/SalesCharts";
import { SalesFilterBar } from "@/components/SalesFilterBar";
import { SalesTable } from "@/components/SalesTable";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesSummaryCards } from "@/components/SalesSummaryCards";
import { getFuelColors } from '@/lib/fuelColors';

export default function Sales() {
  const isToday = useState(true)[0];
  const selectedStationId = useState<number | null>(null)[0];
  
  const [isAddSaleOpen, setIsAddSaleOpen] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    station_id: '',
    pump_id: '',
    nozzle_id: '',
    cumulative_volume: ''
  });
  // NEW: Add pagination/page state
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { toast } = useToast();
  const { user } = useAuth();
  const { data: sales, isLoading } = useSalesData(isToday ? new Date().toISOString().split('T')[0] : undefined);
  const { data: pumps } = usePumpsData();
  // Utility: Given nozzleId, find nozzle (and parent pump) in pumpsData
  const getNozzle = (nozzleId: number) => {
    if (!nozzleId || !pumps) return null;
    for (const pump of pumps) {
      const nozzle = pump.nozzles?.find((n) => Number(n.id) === nozzleId);
      if (nozzle) {
        return { ...nozzle, pump };
      }
    }
    return null;
  };
  const { currentStation, canAccessAllStations, stations } = useRoleAccess();
  const { createManualEntry } = useSalesManagement();
  const activeShiftQuery = useActiveShift();
  

  // Debug logging
  useEffect(() => {
    // Debug logging removed
  }, [sales]);

  useEffect(() => {
    if (!canAccessAllStations && currentStation?.id) {
      setManualEntry(prev => ({
        ...prev,
        station_id: currentStation.id.toString(),
      }));
    }
  }, [canAccessAllStations, currentStation]);

  // FILTERS - controlled by filter bar
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: new Date(),
    end: new Date(),
  });
  const [productType, setProductType] = useState<string>("");
  // Add filter bar controlled state for pumpId and nozzleId
  const [barPumpId, setBarPumpId] = useState<string>("");
  const [barNozzleId, setBarNozzleId] = useState<string>("");

  // derive stationId and fuelType for price check based on manualEntry selection
  const stationForPrice = manualEntry.station_id || (currentStation?.id ? String(currentStation.id) : '');
  const nozzleObjForPrice = typeof manualEntry.nozzle_id === 'string' && manualEntry.nozzle_id !== ''
    ? getNozzle(parseInt(manualEntry.nozzle_id, 10))
    : typeof manualEntry.nozzle_id === 'number'
    ? getNozzle(manualEntry.nozzle_id)
    : null;
  const fuelTypeForPrice = nozzleObjForPrice?.fuel_type || '';
  const priceDate = dateRange?.start ? new Date(dateRange.start).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const priceCheckQuery = usePriceCheck(stationForPrice, fuelTypeForPrice, priceDate);

  

  // Filter logic using actual Sale structure with fuel_type directly available
  const filteredSales = sales?.filter(sale => {
    // Date filter - use reading_date (YYYY-MM-DD string) for comparison
    if (dateRange.start && dateRange.end && sale.reading_date) {
      const saleDate = new Date(sale.reading_date);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      
      // Normalize to compare only dates (not times)
      saleDate.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      if (saleDate < startDate || saleDate > endDate) {
        return false;
      }
    }

    // Product type (fuel) - fuel_type is directly on sale object
    if (productType && sale.fuel_type?.toUpperCase() !== productType.toUpperCase()) {
      return false;
    }

    // Pump filter - pump_id is directly on sale object (string)
    if (barPumpId && sale.pump_id !== barPumpId) {
      return false;
    }

    // Nozzle filter - nozzle_id is directly on sale object (string)
    if (barNozzleId && sale.nozzle_id !== barNozzleId) {
      return false;
    }

    // Station filter (if still using old number-based filter)
    if (selectedStationId && sale.station_id !== selectedStationId.toString()) {
      return false;
    }

    return true;
  }) || [];

  // Pagination
  const pagedSales = filteredSales.slice((page - 1) * pageSize, page * pageSize);

  // Get pumps and nozzles list for filter bar
  const pumpsList = pumps || [];
  const nozzlesList = pumpsList
    .find(p => p.id?.toString() === barPumpId)?.nozzles || [];

  

  // Type correction for ID comparisons
  const selectedStationIdParsed =
    manualEntry.station_id && typeof manualEntry.station_id === "string"
      ? parseInt(manualEntry.station_id, 10)
      : manualEntry.station_id
      ? manualEntry.station_id
      : undefined;

  // Fix: Ensure availablePumps uses correct number type
  const availablePumps = pumps?.filter(
    (pump) =>
      !manualEntry.station_id ||
      pump.stationId === selectedStationIdParsed
  ) || [];

  // Fix: Ensure availableNozzles uses correct number type
  const manualPumpIdString = manualEntry.pump_id ? String(manualEntry.pump_id) : '';
  const availableNozzles =
    availablePumps.find((pump) => String(pump.id) === manualPumpIdString)?.nozzles || [];

  const handleManualEntry = async () => {
    if (!manualEntry.station_id || !manualEntry.nozzle_id || !manualEntry.cumulative_volume) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Parse values
    const stationIdNum = parseInt(manualEntry.station_id, 10);
    const nozzleIdNum = typeof manualEntry.nozzle_id === 'string' ? parseInt(manualEntry.nozzle_id, 10) : manualEntry.nozzle_id;
    const cumulativeVolume = parseFloat(manualEntry.cumulative_volume);

    // Validate numeric parsing
    if (Number.isNaN(stationIdNum) || Number.isNaN(nozzleIdNum) || Number.isNaN(cumulativeVolume)) {
      toast({ title: 'Invalid values', description: 'Please enter valid numeric values', variant: 'destructive' });
      return;
    }

    // 1) Fetch previous reading for the nozzle and ensure cumulative_volume > previousReading
    try {
      // Ensure an active shift exists (backend requires shift for many plans)
      const activeShift = activeShiftQuery.data?.data || (activeShiftQuery.data as any) || null;
      if (!activeShift) {
        toast({ title: 'No active shift', description: 'Please start a shift before recording readings.', variant: 'destructive' });
        return;
      }

      // Enforce plan backdate limit if available via user.plan
      const planLimitDays = (user as any)?.plan?.backdate_limit_days || (user as any)?.plan?.backdateLimit || null;
      if (planLimitDays !== null && planLimitDays !== undefined) {
        const today = new Date();
        const selectedDate = new Date(); // manual entries assume today; if you support date input, use that value
        const diffDays = Math.floor((today.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > Number(planLimitDays)) {
          toast({ title: 'Backdate limit exceeded', description: `Your plan allows backdating only up to ${planLimitDays} days.`, variant: 'destructive' });
          return;
        }
      }

      const prevRes = await apiClient.get(`/readings/nozzles/${nozzleIdNum}/previous`);
      // response may be envelope { success, data } or bare object
      const prevData = (prevRes as any).data || prevRes;
      const prevValue = Number(prevData.previousReading ?? prevData.previous_reading ?? 0);

      if (!Number.isFinite(prevValue)) {
        // treat missing previous as 0
      }

      if (cumulativeVolume <= prevValue) {
        toast({ title: 'Invalid reading', description: `Cumulative volume must be greater than previous reading (${prevValue})`, variant: 'destructive' });
        return;
      }

      // 2) Verify a price exists for the nozzle's fuel type and date using cached hook
      if (!fuelTypeForPrice) {
        toast({ title: 'Nozzle data missing', description: 'Unable to determine fuel type for selected nozzle', variant: 'destructive' });
        return;
      }

      // If the query hasn't run yet, try refetching to ensure up-to-date info
      let priceDataObj = priceCheckQuery.data?.data || (priceCheckQuery.data as any);
      if (!priceDataObj) {
        const ref = await priceCheckQuery.refetch();
        priceDataObj = (ref.data as any)?.data || ref.data;
      }

      const priceSet = !!(priceDataObj?.priceSet || priceDataObj?.price || priceDataObj?.price_set);
      if (!priceSet) {
        toast({ title: 'Price not set', description: 'Price for selected fuel/date is not set. Please set the fuel price before recording readings.', variant: 'destructive' });
        return;
      }
    } catch (err: unknown) {
      console.error('Validation check failed', err);
      toast({ title: 'Validation failed', description: 'Could not verify previous reading or price. Try again.', variant: 'destructive' });
      return;
    }

    try {
      await createManualEntry.mutateAsync({
        station_id: stationIdNum,
        nozzle_id: nozzleIdNum,
        cumulative_volume: cumulativeVolume,
        user_id: typeof user?.id === "string" ? user.id : "",
      });

      setIsAddSaleOpen(false);
      setManualEntry({ station_id: '', pump_id: '', nozzle_id: '', cumulative_volume: '' });
      toast({ title: "Success", description: "Manual entry recorded successfully", variant: "success" });
    } catch (error: unknown) {
      let message = 'Failed to record manual entry';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error && 'message' in error) {
        message = String((error as { message?: string }).message);
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  

  if (!currentStation && !canAccessAllStations) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-7xl ml-4 lg:ml-6">
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
      <div className="container mx-auto p-4 max-w-7xl ml-4 lg:ml-6">
        <Skeleton className="h-12 w-full mb-4" />
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 md:p-4 lg:p-6 max-w-7xl flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold">Sales Management</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Track and manage sales {currentStation ? `for ${currentStation.name}` : 'across all stations'}
          </p>
        </div>

        <Dialog open={isAddSaleOpen} onOpenChange={setIsAddSaleOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto shadow-sm text-sm md:text-base">
              <Plus className="w-4 h-4 mr-2" />
              Manual Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="text-lg">Manual Sales Entry</DialogTitle>
              <DialogDescription className="text-sm">
                Select Station → Pump → Nozzle → Enter cumulative volume for automatic calculation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {canAccessAllStations || currentStation ? (
                <div>
                  <Label htmlFor="station_select">Station</Label>
                  <Select
                    value={manualEntry.station_id}
                    onValueChange={(value) => {
                      setManualEntry(prev => ({ ...prev, station_id: value, pump_id: '', nozzle_id: '' }));
                    }}
                    disabled={!canAccessAllStations}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent>
                      {(canAccessAllStations ? stations : currentStation ? [currentStation] : [])
                        .filter(station => station.id != null && station.id !== undefined)
                        .map(station => (
                        <SelectItem key={station.id} value={String(station.id)}>
                          {station.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div>
                <Label htmlFor="pump_select">Pump</Label>
                <Select
                  value={manualEntry.pump_id}
                  onValueChange={(value) => {
                    setManualEntry(prev => ({ ...prev, pump_id: value, nozzle_id: '' }));
                  }}
                  disabled={!manualEntry.station_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pump" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePumps
                      .filter(pump => pump.id != null && pump.id !== undefined)
                      .map(pump => (
                        <SelectItem key={pump.id} value={String(pump.id)}>
                          {pump.name || `Pump ${pump.pump_sno}`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="nozzle_select">Nozzle (Price auto-picked from fuel prices)</Label>
                <Select
                  value={manualEntry.nozzle_id}
                  onValueChange={(value) => setManualEntry(prev => ({ ...prev, nozzle_id: value }))}
                  disabled={!manualEntry.pump_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select nozzle" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableNozzles
                      .filter(nozzle => nozzle.id != null && nozzle.id !== undefined)
                      .map(nozzle => {
                        const colors = getFuelColors(nozzle.fuel_type);
                        return (
                          <SelectItem key={nozzle.id} value={String(nozzle.id)}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                              <span>#{nozzle.nozzle_number} - {nozzle.fuel_type}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="cumulative_volume">Cumulative Volume (L) - Total auto-calculated</Label>
                <Input
                  id="cumulative_volume"
                  type="number"
                  step="0.001"
                  value={manualEntry.cumulative_volume}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, cumulative_volume: e.target.value }))}
                  placeholder="e.g., 1234.567"
                />
              </div>

              <Button
                onClick={handleManualEntry}
                disabled={createManualEntry.isPending}
                className="w-full"
              >
                {createManualEntry.isPending ? 'Processing...' : 'Record Entry'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Bar */}
      <SalesFilterBar
        // The SalesFilterBar component: send "all" as the default for no filter (not "")
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        productType={productType}
        onProductTypeChange={setProductType}
        pumpId={barPumpId === "" ? "all" : barPumpId}
        onPumpIdChange={val => { setBarPumpId(val === "all" ? "" : val); setBarNozzleId(""); }}
        nozzleId={barNozzleId === "" ? "all" : barNozzleId}
        onNozzleIdChange={val => setBarNozzleId(val === "all" ? "" : val)}
        pumps={pumpsList}
        nozzles={nozzlesList}
        isMobile={true}
      />

      <Tabs defaultValue="overview" className="space-y-4 md:space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger value="overview" className="text-xs md:text-sm py-2">Overview</TabsTrigger>
          <TabsTrigger value="charts" className="text-xs md:text-sm py-2">Charts</TabsTrigger>
          <TabsTrigger value="transactions" className="text-xs md:text-sm py-2">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SalesSummaryCards
            totalRevenue={filteredSales.reduce((s, sale) => s + (sale.total_amount || 0), 0)}
            totalVolume={filteredSales.reduce((s, sale) => s + (sale.delta_volume_l || 0), 0)}
            transactionCount={filteredSales.length}
          />
        </TabsContent>

        <TabsContent value="charts" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChartBar className="w-5 h-5" />
                Sales Analytics
              </CardTitle>
              <CardDescription>
                Visual insights into your sales performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SalesCharts salesData={filteredSales as any} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          {/* Sales Table */}
          <div className="bg-background rounded-lg shadow-sm p-2">
            <SalesTable
              sales={pagedSales as any}
              loading={isLoading}
              page={page}
              pageSize={pageSize}
              total={filteredSales.length}
              onPageChange={setPage}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// (SVG sprite helper removed - not used)
