import { toNumber } from '@/utils/number';



import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { IndianRupee, Building2 } from "lucide-react";
import { useFuelPricesData } from "@/hooks/useFuelPricesData";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { FuelPriceDialog } from "@/components/prices/FuelPriceDialog";
import { FuelPricesGrid } from '@/components/prices/FuelPricesGrid';
import { FuelPriceAddButton } from '@/components/prices/FuelPriceAddButton';
import { apiClient } from '@/lib/api-client';
import { FuelTypeEnum } from '@/core/enums';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Prices Page - Manage fuel prices per station
 * 
 * Architecture:
 * - Accessed via `/owner/stations/:id/prices` (station-specific)
 * - Also accessible via dropdown selector on same page
 * - Each station has its own fuel prices
 * - Shows which station's prices are being managed
 */
export default function PricesPage() {
  const { id: routeStationId } = useParams<{ id?: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [selectedFuelType, setSelectedFuelType] = useState<"PETROL" | "DIESEL" | "CNG" | "EV" | undefined>(undefined);
  const [selectedPrice, setSelectedPrice] = useState<string>("");
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [addEditLoading, setAddEditLoading] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { stations, isOwner, isAdmin } = useRoleAccess();
  
  // Determine which station to show prices for:
  // 1. Use route parameter if accessing via /owner/stations/:id/prices
  // 2. Fall back to user selection if on generic /prices page
  // 3. Default to first station
  const defaultStationId = useMemo(() => {
    if (routeStationId) {
      return routeStationId;
    }
    return selectedStationId || stations[0]?.id || "";
  }, [routeStationId, selectedStationId, stations]);
  
  // Fetch prices for the SELECTED station (not relying on currentStation)
  const { data: fuelPrices, error: pricesError } = useFuelPricesData(defaultStationId);
  
  // Get the currently selected station details
  const currentStation = useMemo(() => {
    return stations.find(s => s.id === defaultStationId) || stations[0];
  }, [defaultStationId, stations]);

  // Use fuel types from the single source of truth
  const ALL_FUEL_TYPES = Object.values(FuelTypeEnum);
  // Ensure fuelPrices is an array before calling map
  const presentFuelTypes = Array.isArray(fuelPrices) ? fuelPrices.map(p => p.fuel_type) : [];
  const missingFuelTypes = ALL_FUEL_TYPES.filter(
    ft => !presentFuelTypes.includes(ft)
  );

  function isValidFuelType(ft: string): boolean {
    return Object.values(FuelTypeEnum).includes(ft as FuelTypeEnum);
  }

  // Show loading if stations are not loaded yet
  if (!stations || stations.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading stations...</p>
              <p className="text-sm text-muted-foreground mt-2">
                If this takes too long, try refreshing the page or logging out and back in.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Make sure you're logged in as an owner or admin with access to stations.
              </p>
              <div className="mt-4">
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openAddDialog = () => {
    setDialogMode("add");
    setDialogOpen(true);
    setSelectedFuelType(undefined);
    setSelectedPrice("");
  };
  const openEditDialog = (
    fuelType: string,
    price: number,
    _id: number | string, // id is not used
    costPrice?: number | null
  ) => {
    if (isValidFuelType(fuelType)) {
      setDialogMode("edit");
      setDialogOpen(true);
      if (Object.values(FuelTypeEnum).includes(fuelType as FuelTypeEnum)) {
        setSelectedFuelType(fuelType as "PETROL" | "DIESEL" | "CNG" | "EV");
      } else {
        setSelectedFuelType(undefined);
      }
      setSelectedPrice(price.toString());
      // Store cost price in state for passing to dialog
      (window as any).__selectedCostPrice = costPrice || null;
    } else {
      return;
    }
  };

  const handleDialogSubmit = (
    input: { fuel_type: "PETROL" | "DIESEL" | "CNG" | "EV"; price_per_litre: string; cost_price?: string }
  ) => {
    setAddEditLoading(true);

    if (!input.price_per_litre) {
      toast({
        title: "Missing Information",
        description: "Please enter the price per litre",
        variant: "destructive",
      });
      setAddEditLoading(false);
      return;
    }
    const price = toNumber(input.price_per_litre);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price greater than 0",
        variant: "destructive",
      });
      setAddEditLoading(false);
      return;
    }

    // Validate cost price if provided
    let costPrice: number | undefined = undefined;
    if (input.cost_price) {
      costPrice = toNumber(input.cost_price);
      if (isNaN(costPrice) || costPrice <= 0) {
        toast({
          title: "Invalid Cost Price",
          description: "Please enter a valid cost price greater than 0",
          variant: "destructive",
        });
        setAddEditLoading(false);
        return;
      }
      if (costPrice >= price) {
        toast({
          title: "Invalid Cost Price",
          description: "Cost price must be less than selling price",
          variant: "destructive",
        });
        setAddEditLoading(false);
        return;
      }
    }

    // Use the correct endpoint: /stations/:stationId/prices
    apiClient.post<{ success: boolean; data: unknown }>(`/stations/${defaultStationId}/prices`, {
      fuelType: input.fuel_type.toLowerCase(), // Backend expects lowercase
      price: price,
      costPrice: costPrice,
      effectiveFrom: new Date().toISOString(),
    })
      .then(() => {
        toast({
          title: "Success",
          description: `Fuel price ${dialogMode === "add" ? "added" : "updated"} successfully`,
        });
        setDialogOpen(false);
        setSelectedFuelType(undefined);
        setSelectedPrice("");
        queryClient.invalidateQueries({ queryKey: ["fuel-prices"] });
        queryClient.invalidateQueries({ queryKey: ["all-fuel-prices"] });
        // Also invalidate stations to update displayed data
        queryClient.invalidateQueries({ queryKey: ["stations"] });
      })
      .catch((error: unknown) => {
        let errorMessage = "Failed to update fuel price";
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
      })
      .finally(() => setAddEditLoading(false));
  };

  if (!defaultStationId && !isAdmin) {
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

  if (pricesError) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Error loading fuel prices</p>
              <p className="text-sm text-muted-foreground mt-2">
                {(pricesError as unknown) instanceof Error ? (pricesError as Error).message : 'Unknown error occurred'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }  return (
    <div className="w-full px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Fuel Prices</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Manage fuel prices for your stations
        </p>
      </div>

      {/* Station Selection - Show if accessing from /prices route, hide if from /owner/stations/:id/prices */}
      {!routeStationId && (isOwner || isAdmin) && stations.length > 1 && (
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-sm sm:text-base">Select Station</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={defaultStationId} onValueChange={setSelectedStationId}>
              <SelectTrigger className="text-sm sm:text-base">
                <SelectValue placeholder="Choose a station" />
              </SelectTrigger>
              <SelectContent>
                {stations.map((station) => (
                  <SelectItem key={station.id} value={station.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {station.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Prices Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold">
            {currentStation ? currentStation.name : "Fuel Prices"}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Set prices for different fuel types at this station
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <FuelPriceAddButton
            onAdd={openAddDialog}
            disabled={missingFuelTypes.length === 0}
            isVisible={isOwner || isAdmin}
          />
        </div>
      </div>

      <FuelPriceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        fuelTypes={
          dialogMode === "add"
            ? (missingFuelTypes as string[])
            : [(selectedFuelType || "PETROL") as string]
        }
        mode={dialogMode}
        initialFuelType={selectedFuelType}
        initialPrice={selectedPrice}
        initialCostPrice={(window as any).__selectedCostPrice ? ((window as any).__selectedCostPrice).toString() : ""}
        loading={addEditLoading}
        onSubmit={(input) => {
          // Clean up temp storage
          delete (window as any).__selectedCostPrice;
          handleDialogSubmit(input as { fuel_type: "PETROL" | "DIESEL" | "CNG" | "EV"; price_per_litre: string; cost_price?: string });
        }}
      />

      <FuelPricesGrid
        fuelPrices={Array.isArray(fuelPrices) ? (fuelPrices as any) : undefined}
        isOwner={isOwner}
        isAdmin={isAdmin}
        onEdit={openEditDialog}
      />

      {(!fuelPrices || fuelPrices.length === 0) && (
        <Card>
          <CardContent className="pt-6 text-center">
            <IndianRupee className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No fuel prices set</h3>
            <p className="text-muted-foreground mb-4">
              Get started by setting prices for different fuel types at {currentStation?.name || "this station"}.
            </p>
            {(isOwner || isAdmin) && (
              <FuelPriceAddButton
                onAdd={openAddDialog}
                isVisible={true}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}