
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
        valid_from: string;
        created_by?: number | string;
        created_at: string;
      }>
    | undefined;
  isOwner: boolean;
  isAdmin: boolean;
  onEdit: (fuelType: string, price: number, id: number | string) => void;
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
            <div className="text-xs sm:text-sm text-muted-foreground mt-2 space-y-1">
              <div>Updated: {new Date(price.valid_from).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
              <div className="hidden sm:block">Valid from: {new Date(price.valid_from).toLocaleString()}</div>
            </div>
            {(isOwner || isAdmin) && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full sm:w-auto text-xs sm:text-sm"
                onClick={() => onEdit(price.fuel_type, price.price_per_litre, price.id)}
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
