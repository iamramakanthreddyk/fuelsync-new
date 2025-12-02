import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Fuel, IndianRupee } from "lucide-react";
import { getFuelColors } from '@/lib/fuelColors';

interface FuelPriceCardProps {
  prices: {
    PETROL?: number;
    DIESEL?: number;
    CNG?: number;
    EV?: number;
  };
  isLoading?: boolean;
}

export const FuelPriceCard: React.FC<FuelPriceCardProps> = ({ prices, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg border animate-pulse">
        <Fuel className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-xs sm:text-sm text-muted-foreground">Loading prices...</span>
      </div>
    );
  }

  const fuelTypes = [
    { key: 'PETROL', label: 'Petrol' },
    { key: 'DIESEL', label: 'Diesel' },
    { key: 'CNG', label: 'CNG' },
    { key: 'EV', label: 'EV' },
  ];

  // Filter to only show fuels that have prices set
  const setPrices = fuelTypes.filter(
    ({ key }) => prices[key as keyof typeof prices] !== undefined && 
                 prices[key as keyof typeof prices] !== null
  );

  // If no prices are set, show a compact message
  if (setPrices.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
        <Fuel className="h-4 w-4 text-amber-600 flex-shrink-0" />
        <span className="text-xs sm:text-sm font-medium text-amber-700">No fuel prices set</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 py-2 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20 flex-wrap">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Fuel className="h-4 w-4 text-primary" />
        <span className="text-xs sm:text-sm font-semibold text-foreground hidden sm:inline">Prices:</span>
      </div>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {setPrices.map(({ key, label }) => {
          const colors = getFuelColors(label);
          return (
            <div 
              key={key} 
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background border shadow-sm hover:shadow transition-all ${colors.ring} ring-1`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              <span className="text-xs font-bold flex items-center text-foreground">
                <IndianRupee className="w-2.5 h-2.5" />
                {typeof prices[key as keyof typeof prices] === 'number' 
                  ? prices[key as keyof typeof prices]?.toFixed(2) 
                  : 'N/A'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
