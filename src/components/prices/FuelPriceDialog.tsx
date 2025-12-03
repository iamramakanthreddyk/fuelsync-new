import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { FUEL_TYPE_LABELS } from '@/lib/constants';

interface FuelPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fuelTypes: string[];
  mode: "add" | "edit";
  initialFuelType?: string;
  initialPrice?: string;
  loading?: boolean;
  onSubmit: (input: { fuel_type: string; price_per_litre: string }) => void;
}

export const FuelPriceDialog: React.FC<FuelPriceDialogProps> = ({
  open,
  onOpenChange,
  fuelTypes,
  mode,
  initialFuelType,
  initialPrice = "",
  loading,
  onSubmit,
}) => {
  const [fuelType, setFuelType] = useState(initialFuelType || fuelTypes[0] || "");
  const [price, setPrice] = useState(initialPrice);

  // Reset dialog state when opening
  React.useEffect(() => {
    setFuelType(initialFuelType || fuelTypes[0] || "");
    setPrice(initialPrice || "");
  }, [open, initialFuelType, fuelTypes, initialPrice]);

  const isAdd = mode === "add";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isAdd ? "Add New Fuel Price" : `Edit ${FUEL_TYPE_LABELS[fuelType] || fuelType} Price`}</DialogTitle>
          <DialogDescription>
            {isAdd ? "Set price for a new fuel type." : "Update the price per litre for this fuel type."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            onSubmit({ 
              fuel_type: fuelType as "PETROL" | "DIESEL" | "CNG" | "EV",
              price_per_litre: price
            });
          }}
        >
          {isAdd && (
            <div>
              <Label htmlFor="fuel_type">Fuel Type</Label>
              <Select value={fuelType} onValueChange={setFuelType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select fuel type" />
                </SelectTrigger>
                <SelectContent>
                  {fuelTypes.map(ft => (
                    <SelectItem key={ft} value={ft}>
                      {FUEL_TYPE_LABELS[ft] || ft}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="price_per_litre">Price per Litre (₹)</Label>
            <Input
              id="price_per_litre"
              type="number"
              step="0.01"
              value={price}
              required
              min={0.01}
              onChange={e => setPrice(e.target.value)}
              placeholder="e.g., 102.50"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (isAdd ? "Adding..." : "Updating...") : isAdd ? "Add Price" : "Update Price"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
