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
  initialCostPrice?: string;
  loading?: boolean;
  onSubmit: (input: { fuel_type: string; price_per_litre: string; cost_price?: string }) => void;
}

export const FuelPriceDialog: React.FC<FuelPriceDialogProps> = ({
  open,
  onOpenChange,
  fuelTypes,
  mode,
  initialFuelType,
  initialPrice = "",
  initialCostPrice = "",
  loading,
  onSubmit,
}) => {
  const [fuelType, setFuelType] = useState(initialFuelType || fuelTypes[0] || "");
  const [price, setPrice] = useState(initialPrice);
  const [costPrice, setCostPrice] = useState(initialCostPrice);
  const [profitInfo, setProfitInfo] = useState<{ profit: number; margin: string } | null>(null);
  const [costPriceError, setCostPriceError] = useState("");

  const isAdd = mode === "add";

  // Calculate profit when prices change
  React.useEffect(() => {
    const sellingPrice = parseFloat(price) || 0;
    const cost = parseFloat(costPrice) || 0;
    
    if (sellingPrice > 0 && cost > 0 && cost < sellingPrice) {
      const profit = sellingPrice - cost;
      const margin = ((profit / sellingPrice) * 100).toFixed(2);
      setProfitInfo({ profit: parseFloat(profit.toFixed(2)), margin });
      setCostPriceError("");
    } else if (cost > 0 && sellingPrice > 0 && cost >= sellingPrice) {
      setProfitInfo(null);
      setCostPriceError("Cost price must be less than selling price");
    } else {
      setProfitInfo(null);
      setCostPriceError("");
    }
  }, [price, costPrice]);

  // Reset dialog state when opening
  React.useEffect(() => {
    if (open) {
      setFuelType(initialFuelType || fuelTypes[0] || "");
      setPrice(initialPrice || "");
      setCostPrice(initialCostPrice || "");
      setCostPriceError("");
    }
  }, [open, initialFuelType, initialPrice, initialCostPrice]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate cost price if provided
    if (costPrice) {
      const costPriceNum = parseFloat(costPrice);
      const sellingPriceNum = parseFloat(price);
      if (costPriceNum >= sellingPriceNum) {
        setCostPriceError("Cost price must be less than selling price");
        return;
      }
    }

    onSubmit({
      fuel_type: fuelType,
      price_per_litre: price,
      cost_price: costPrice || undefined
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isAdd ? "Add Fuel Price" : "Edit Fuel Price"}
          </DialogTitle>
          <DialogDescription>
            {isAdd 
              ? "Set the fuel price for a new fuel type" 
              : "Update the fuel price and optionally set the purchase price for profit tracking"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isAdd && (
            <div>
              <Label htmlFor="fuel_type">Fuel Type *</Label>
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
            <Label htmlFor="price_per_litre">Selling Price per Litre (₹) *</Label>
            <Input
              id="price_per_litre"
              type="number"
              step="0.01"
              value={price}
              required
              min={0.01}
              onChange={e => setPrice(e.target.value)}
              placeholder="e.g., 112.00"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="cost_price">
              Purchase Price per Litre (₹)
              <span className="text-xs text-gray-500 ml-2">Optional - for profit tracking</span>
            </Label>
            <Input
              id="cost_price"
              type="number"
              step="0.01"
              value={costPrice}
              min={0.01}
              onChange={e => setCostPrice(e.target.value)}
              placeholder="e.g., 100.00"
            />
            {costPriceError && (
              <p className="text-xs text-red-600 mt-1">{costPriceError}</p>
            )}
          </div>
          {profitInfo && (
            <div className="bg-green-50 p-3 rounded border border-green-200">
              <p className="text-sm font-medium text-green-800">
                ✓ Profit per Litre: ₹{profitInfo.profit.toFixed(2)}
              </p>
              <p className="text-xs text-green-700">
                Margin: {profitInfo.margin}%
              </p>
            </div>
          )}
          <Button 
            type="submit" 
            disabled={loading || !price || (costPrice && costPriceError !== "")} 
            className="w-full"
          >
            {loading ? (isAdd ? "Adding..." : "Updating...") : isAdd ? "Add Price" : "Update Price"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
