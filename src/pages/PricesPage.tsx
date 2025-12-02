
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, IndianRupee } from "lucide-react";
import { useFuelPricesData } from "@/hooks/useFuelPricesData";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useAuth } from "@/hooks/useAuth";
import { FuelPriceDialog } from "@/components/prices/FuelPriceDialog";
import { FuelPricesGrid } from '@/components/prices/FuelPricesGrid';
import { FuelPriceAddButton } from '@/components/prices/FuelPriceAddButton';
import { apiClient, ApiResponse } from '@/lib/api-client';

export default function PricesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [selectedFuelType, setSelectedFuelType] = useState<"PETROL" | "DIESEL" | "CNG" | "EV" | undefined>(undefined);
  const [selectedPrice, setSelectedPrice] = useState<string>("");
  const [editId, setEditId] = useState<number | undefined>(undefined);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: fuelPrices, isLoading } = useFuelPricesData();
  const { currentStation, isOwner, isAdmin } = useRoleAccess();

  const ALL_FUEL_TYPES: ("PETROL" | "DIESEL" | "CNG" | "EV")[] = ["PETROL", "DIESEL", "CNG", "EV"];
  const presentFuelTypes = fuelPrices?.map(p => p.fuel_type) ?? [];
  const missingFuelTypes = ALL_FUEL_TYPES.filter(
    ft => !presentFuelTypes.includes(ft)
  );

  const [addEditLoading, setAddEditLoading] = useState(false);
  function isValidFuelType(ft: string): ft is "PETROL" | "DIESEL" | "CNG" | "EV" {
    return ["PETROL", "DIESEL", "CNG", "EV"].includes(ft);
  }

  const openAddDialog = () => {
    setDialogMode("add");
    setDialogOpen(true);
    setSelectedFuelType(undefined);
    setSelectedPrice("");
    setEditId(undefined);
  };
  const openEditDialog = (
    fuelType: string,
    price: number,
    id: number
  ) => {
    if (isValidFuelType(fuelType)) {
      setDialogMode("edit");
      setDialogOpen(true);
      setSelectedFuelType(fuelType);
      setSelectedPrice(price.toString());
      setEditId(id);
    } else {
      return;
    }
  };

  const handleDialogSubmit = (
    input: { fuel_type: "PETROL" | "DIESEL" | "CNG" | "EV"; price_per_litre: string }
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
    const price = parseFloat(input.price_per_litre);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price greater than 0",
        variant: "destructive",
      });
      setAddEditLoading(false);
      return;
    }

    // Use the correct endpoint: /stations/:stationId/prices
    apiClient.post<{ success: boolean; data: unknown }>(`/stations/${currentStation?.id}/prices`, {
      fuelType: input.fuel_type.toLowerCase(), // Backend expects lowercase
      price: price,
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
        setEditId(undefined);
        queryClient.invalidateQueries({ queryKey: ["fuel-prices"] });
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
        <div className="text-center">Loading fuel prices...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Fuel Prices</h1>
          <p className="text-muted-foreground">
            Manage fuel prices {currentStation ? `for ${currentStation.name}` : "across all stations"}
          </p>
        </div>
        <FuelPriceAddButton
          onAdd={openAddDialog}
          disabled={missingFuelTypes.length === 0}
          isVisible={isOwner || isAdmin}
        />
      </div>

      <FuelPriceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        fuelTypes={
          dialogMode === "add"
            ? (missingFuelTypes as ("PETROL" | "DIESEL" | "CNG" | "EV")[])
            : [(selectedFuelType || "PETROL") as "PETROL" | "DIESEL" | "CNG" | "EV"]
        }
        mode={dialogMode}
        initialFuelType={selectedFuelType}
        initialPrice={selectedPrice}
        loading={addEditLoading}
        onSubmit={handleDialogSubmit}
      />

      <FuelPricesGrid
        fuelPrices={fuelPrices}
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
              Get started by setting prices for different fuel types.
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
