/**
 * SaleCalculation Component
 * 
 * Displays calculated sale values from meter readings:
 * - Litres sold (current - previous)
 * - Sale value (litres × price)
 * 
 * Updates in real-time as user enters current reading.
 */

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Droplets, IndianRupee, TrendingUp, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SaleCalculationProps {
  previousReading: number;
  currentReading: number;
  pricePerLitre: number;
  fuelType?: string;
  className?: string;
}

export function SaleCalculation({
  previousReading,
  currentReading,
  pricePerLitre,
  fuelType = 'Fuel',
  className
}: SaleCalculationProps) {
  const calculations = useMemo(() => {
    const litresSold = Math.max(0, currentReading - previousReading);
    const saleValue = litresSold * pricePerLitre;
    const isValid = currentReading >= previousReading && litresSold > 0;
    
    return {
      litresSold,
      saleValue,
      isValid,
      hasEntry: currentReading > 0
    };
  }, [previousReading, currentReading, pricePerLitre]);

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;

  const formatLitres = (litres: number) => `${litres.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} L`;

  if (!calculations.hasEntry) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="p-4 text-center text-muted-foreground">
          <Gauge className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Enter current reading to see calculations</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "border-2 transition-all duration-300",
      calculations.isValid 
        ? "border-green-200 bg-gradient-to-br from-green-50/50 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10" 
        : "border-red-200 bg-red-50/30 dark:bg-red-950/10",
      className
    )}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Sale Calculation
          </h4>
          {fuelType && (
            <Badge variant="outline" className="text-xs">
              {fuelType}
            </Badge>
          )}
        </div>

        {/* Readings Summary */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-muted/50 rounded-lg p-2">
            <p className="text-xs text-muted-foreground">Previous</p>
            <p className="font-semibold">{formatLitres(previousReading)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="font-semibold">{formatLitres(currentReading)}</p>
          </div>
        </div>

        {/* Calculated Values */}
        <div className="grid grid-cols-2 gap-4">
          {/* Litres Sold */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Droplets className="w-3 h-3" />
              Litres Sold
            </div>
            <p className={cn(
              "text-xl font-bold",
              calculations.isValid ? "text-blue-600" : "text-red-600"
            )}>
              {formatLitres(calculations.litresSold)}
            </p>
          </div>

          {/* Sale Value */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <IndianRupee className="w-3 h-3" />
              Sale Value
            </div>
            <p className={cn(
              "text-xl font-bold",
              calculations.isValid ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency(calculations.saleValue)}
            </p>
          </div>
        </div>

        {/* Price Info */}
        <div className="text-xs text-muted-foreground text-center border-t pt-2">
          Price: {formatCurrency(pricePerLitre)}/L × {formatLitres(calculations.litresSold)} = {formatCurrency(calculations.saleValue)}
        </div>

        {/* Warning if invalid */}
        {!calculations.isValid && calculations.hasEntry && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs p-2 rounded-lg">
            ⚠️ Current reading must be greater than previous reading
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SaleCalculation;
