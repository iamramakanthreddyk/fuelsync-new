import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Fuel, IndianRupee } from "lucide-react";

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5" />
            Today's Fuel Prices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading prices...</div>
        </CardContent>
      </Card>
    );
  }

  const fuelTypes = [
    { key: 'PETROL', label: 'Petrol', color: 'bg-green-100 text-green-800' },
    { key: 'DIESEL', label: 'Diesel', color: 'bg-blue-100 text-blue-800' },
    { key: 'CNG', label: 'CNG', color: 'bg-purple-100 text-purple-800' },
    { key: 'EV', label: 'EV', color: 'bg-yellow-100 text-yellow-800' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fuel className="h-5 w-5" />
          Today's Fuel Prices
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {fuelTypes.map(({ key, label, color }) => (
            <div key={key} className="space-y-2">
              <Badge variant="outline" className={color}>
                {label}
              </Badge>
              <div className="text-lg font-semibold flex items-center gap-1">
                <IndianRupee className="w-4 h-4 inline" />
                {prices[key as keyof typeof prices] !== undefined && prices[key as keyof typeof prices] !== null
                  ? `${prices[key as keyof typeof prices]?.toFixed(2)}/L`
                  : 'Not set'
                }
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
