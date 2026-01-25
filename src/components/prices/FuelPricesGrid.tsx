
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFuelBadgeClasses } from "@/lib/fuelColors";
import { safeToFixed } from '@/lib/format-utils';

export interface FuelPricesGridProps {
  fuelPrices:
    | Array<{
        id: number | string;
        station_id: string;
        fuel_type: "PETROL" | "DIESEL" | "CNG" | "EV";
        price_per_litre: number;
        cost_price?: number | null;
        valid_from: string;
        created_by?: number | string;
        created_at: string;
      }>
    | undefined;
  isOwner: boolean;
  isAdmin: boolean;
  onEdit: (fuelType: string, price: number, id: number | string, costPrice?: number | null) => void;
}

export const FuelPricesGrid: React.FC<FuelPricesGridProps> = ({
  fuelPrices,
  isOwner,
  isAdmin,
  onEdit,
}) => {
  if (!fuelPrices || fuelPrices.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
      {fuelPrices.map((price) => (
        <Card key={`${price.station_id}-${price.fuel_type}`}>
          <CardHeader className="pb-2 sm:pb-3">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base">
                  <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="truncate">{price.fuel_type}</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Current Price
                </CardDescription>
              </div>
              <Badge className={`${getFuelBadgeClasses(price.fuel_type.toLowerCase())} text-xs sm:text-sm flex-shrink-0`}>
                {price.fuel_type}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-1">
              <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="break-words">{safeToFixed(price.price_per_litre, 2)}</span>
            </div>
            
            {/* Show cost price and profit if available */}
            {price.cost_price !== null && price.cost_price !== undefined && (
              <div className="mt-3 pt-3 border-t border-muted">
                <div className="text-xs text-muted-foreground mb-2">Cost Price:</div>
                <div className="flex items-center gap-1 mb-2">
                  <IndianRupee className="w-3 h-3" />
                  <span className="text-sm font-medium">{safeToFixed(price.cost_price, 2)}</span>
                </div>
                <div className="bg-green-50 dark:bg-green-950 p-2 rounded text-xs">
                  <div className="text-green-700 dark:text-green-300 font-semibold">
                    ✓ Profit: ₹{safeToFixed(price.price_per_litre - price.cost_price, 2)}/L
                  </div>
                  <div className="text-green-600 dark:text-green-400">
                    Margin: {safeToFixed(((price.price_per_litre - price.cost_price) / price.price_per_litre * 100), 2)}%
                  </div>
                </div>
              </div>
            )}
            
            <div className="text-xs sm:text-sm text-muted-foreground mt-2 space-y-1">
              <div>Updated: {new Date(price.valid_from).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
              <div className="hidden sm:block">Valid from: {new Date(price.valid_from).toLocaleString()}</div>
            </div>
            {(isOwner || isAdmin) && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full sm:w-auto text-xs sm:text-sm"
                onClick={() => onEdit(price.fuel_type, price.price_per_litre, price.id, price.cost_price)}
              >
                Edit
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
