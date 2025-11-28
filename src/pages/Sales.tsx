import React, { useState, useEffect } from 'react';
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, BarChart3, TrendingUp, Filter, ChartBar } from "lucide-react";
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
import { SalesCharts } from "@/components/SalesCharts";
import { SalesFilterBar } from "@/components/SalesFilterBar";
import { SalesTable } from "@/components/SalesTable";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesSummaryCards } from "@/components/SalesSummaryCards";

export default function Sales() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [isToday, setIsToday] = useState(true);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [selectedPumpId, setSelectedPumpId] = useState<number | null>(null);
  const [selectedNozzleId, setSelectedNozzleId] = useState<number | null>(null);
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
  const { data: sales, isLoading } = useSalesData(isToday ? selectedDate : undefined);
  const { data: pumps } = usePumpsData();
  const { currentStation, canAccessAllStations, stations } = useRoleAccess();
  const { createManualEntry } = useSalesManagement();

  // Debug logging
  useEffect(() => {
    console.log('💰 Sales data:', sales);
    console.log('💰 Sales count:', sales?.length);
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

  // Utility: Given nozzleId, find nozzle (and parent pump) in pumpsData
  const getNozzle = (nozzleId: number) => {
    if (!nozzleId || !pumps) return null;
    for (const pump of pumps) {
      const nozzle = pump.nozzles?.find((n: any) => n.id === nozzleId);
      if (nozzle) {
        return { ...nozzle, pump };
      }
    }
    return null;
  };

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

  // Debug logging
  console.log('💰 Sales page - raw sales:', sales?.length);
  console.log('💰 Sales page - filtered sales:', filteredSales.length);
  console.log('💰 Sales page - dateRange:', dateRange);

  // Pagination
  const pagedSales = filteredSales.slice((page - 1) * pageSize, page * pageSize);

  // Get pumps and nozzles list for filter bar
  const pumpsList = pumps || [];
  const nozzlesList = pumpsList
    .find(p => p.id?.toString() === barPumpId)?.nozzles || [];

  const todayTotal = filteredSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
  const todayVolume = filteredSales.reduce((sum, sale) => sum + (sale.delta_volume_l || 0), 0);

  // Type correction for ID comparisons
  const selectedStationIdParsed =
    manualEntry.station_id && typeof manualEntry.station_id === "string"
      ? parseInt(manualEntry.station_id, 10)
      : manualEntry.station_id
      ? manualEntry.station_id
      : undefined;

  const selectedPumpIdParsed =
    manualEntry.pump_id && typeof manualEntry.pump_id === "string"
      ? parseInt(manualEntry.pump_id, 10)
      : manualEntry.pump_id
      ? manualEntry.pump_id
      : undefined;

  // Fix: Ensure availablePumps uses correct number type
  const availablePumps = pumps?.filter(
    (pump) =>
      !manualEntry.station_id ||
      pump.station_id === selectedStationIdParsed
  ) || [];

  // Fix: Ensure availableNozzles uses correct number type
  const availableNozzles =
    availablePumps.find((pump) => pump.id === (
      typeof manualEntry.pump_id === "string"
        ? parseInt(manualEntry.pump_id, 10)
        : manualEntry.pump_id
    ))?.nozzles || [];

  const handleManualEntry = async () => {
    if (!manualEntry.station_id || !manualEntry.nozzle_id || !manualEntry.cumulative_volume) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await createManualEntry.mutateAsync({
        station_id: parseInt(manualEntry.station_id),
        // Ensure nozzle_id is always passed as a number
        nozzle_id:
          typeof manualEntry.nozzle_id === "string"
            ? Number.isNaN(parseInt(manualEntry.nozzle_id, 10))
              ? 0
              : parseInt(manualEntry.nozzle_id, 10)
            : typeof manualEntry.nozzle_id === "number"
            ? manualEntry.nozzle_id
            : 0,
        cumulative_volume: parseFloat(manualEntry.cumulative_volume),
        user_id: typeof user?.id === "string" ? user.id : "",
      });

      setIsAddSaleOpen(false);
      setManualEntry({ station_id: '', pump_id: '', nozzle_id: '', cumulative_volume: '' });
      toast({ title: "Success", description: "Manual entry recorded successfully" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record manual entry",
        variant: "destructive",
      });
    }
  };

  const handleDateFilter = (filterType: 'today' | 'range') => {
    setIsToday(filterType === 'today');
    if (filterType === 'today') {
      setSelectedDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
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
    <div className="container mx-auto p-2 md:p-6 max-w-7xl flex flex-col gap-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Sales Management</h1>
          <p className="text-muted-foreground">
            Track and manage sales {currentStation ? `for ${currentStation.name}` : 'across all stations'}
          </p>
        </div>

        <Dialog open={isAddSaleOpen} onOpenChange={setIsAddSaleOpen}>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Manual Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manual Sales Entry</DialogTitle>
              <DialogDescription>
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
                      .map(nozzle => (
                        <SelectItem key={nozzle.id} value={String(nozzle.id)}>
                          #{nozzle.nozzle_number} - {nozzle.fuel_type}
                        </SelectItem>
                      ))}
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
        isMobile={false}
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
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
              <SalesCharts salesData={filteredSales} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          {/* Sales Table */}
          <div className="bg-background rounded-lg shadow-sm p-2">
            <SalesTable
              sales={pagedSales}
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

// Lucide Icon SVG symbol sprite injection for inlined icons (for currencies, droplet, transactions)
const _LucideSVGSprite = () => (
  <svg style={{ display: 'none' }}>
    <symbol id="lucide-indian-rupee" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M6 3h12M6 8.5h12M9 3l5.5 8a4.5 4.5 0 1 1-4.86 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </symbol>
    <symbol id="lucide-droplet" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 2.1l.01 0C12 2.1 18 8.41 18 13.5A6 6 0 0 1 6 13.5c0-5.09 6-11.4 6-11.4Z" />
      <path d="M12 22a4 4 0 0 0 4-4" />
    </symbol>
    <symbol id="lucide-list" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3" y1="6" y2="6" />
      <line x1="3" x2="3" y1="12" y2="12" />
      <line x1="3" x2="3" y1="18" y2="18" />
    </symbol>
  </svg>
);
// Render this sprite in your app root (e.g., in App.tsx) to make the symbols available everywhere.
