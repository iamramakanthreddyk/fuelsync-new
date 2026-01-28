import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Fuel } from 'lucide-react';
import { safeToFixed } from '@/lib/format-utils';

interface SharedSaleSummaryProps {
  saleSummary: {
    totalLiters: number;
    totalSaleValue: number;
    byFuelType: Record<string, { liters: number; value: number }>;
  };
  mode?: 'mobile' | 'desktop';
  readings?: Record<string, any> | any[];
  pumps?: any[] | null;
  fuelPrices?: any[];
  pendingCount?: number;
  totalNozzles?: number;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  hasMultiplePumps?: boolean;
}

export function SharedSaleSummary({
  saleSummary,
  mode = 'desktop',
  readings = {},
  pumps = null,
  fuelPrices = [],
  pendingCount,
  totalNozzles,
  onSubmit,
  isSubmitting = false,
  hasMultiplePumps = false
}: SharedSaleSummaryProps) {
  const isMobile = mode === 'mobile';
  const hasData = saleSummary.totalSaleValue > 0;
  const hasSubmitButton = onSubmit && pendingCount !== undefined && totalNozzles !== undefined;

  // Calculate pending count if not provided
  const calculatedPendingCount = pendingCount ?? (Array.isArray(readings) ? readings.length : Object.keys(readings).length);
  const calculatedTotalNozzles = totalNozzles ?? (pumps?.reduce((sum, pump) => sum + (pump.nozzles?.length || 0), 0) || 0);

  if (!hasData) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-center">
          <Fuel className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {hasMultiplePumps ? 'Select a pump and enter readings' : 'Enter nozzle readings to continue'}
          </p>
          {hasMultiplePumps && (
            <p className="text-xs text-muted-foreground mt-2">
              Use ← → to navigate between pumps
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-green-200 bg-green-50 lg:sticky lg:top-4">
      <CardContent className="p-4 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Total Sale Value</p>
          <p className="text-2xl font-bold text-green-600 break-words">
            ₹{saleSummary.totalSaleValue >= 100000
              ? `${safeToFixed(saleSummary.totalSaleValue / 100000, 1)}L`
              : safeToFixed(saleSummary.totalSaleValue, 2)}
          </p>
        </div>

        {/* Mobile: Progress indicator */}
        {isMobile && hasSubmitButton && (
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{calculatedPendingCount}/{calculatedTotalNozzles} nozzles</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(calculatedPendingCount / calculatedTotalNozzles) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Liters</p>
            <p className="text-lg font-semibold break-words">
              {saleSummary.totalLiters >= 1000
                ? `${safeToFixed(saleSummary.totalLiters / 1000, 1)}K`
                : safeToFixed(saleSummary.totalLiters, 1)}
            </p>
          </div>
          {!isMobile && hasSubmitButton && (
            <div>
              <p className="text-sm text-muted-foreground">Readings</p>
              <p className="text-lg font-semibold">{calculatedPendingCount}/{calculatedTotalNozzles}</p>
            </div>
          )}
          {isMobile && (
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Total Liters Sold</p>
              <p className="text-lg font-semibold">{safeToFixed(saleSummary.totalLiters, 1)} L</p>
            </div>
          )}
        </div>

        {/* Mobile: Quick navigation hint */}
        {isMobile && hasMultiplePumps && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              💡 Swipe or tap arrows to move between pumps
            </p>
          </div>
        )}

        {/* Submit button - only show if onSubmit is provided */}
        {hasSubmitButton && onSubmit && (
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || calculatedPendingCount === 0}
            size={isMobile ? "lg" : "sm"}
            className={`w-full ${isMobile ? 'h-12 text-base' : 'text-sm sm:text-base h-9 sm:h-10'}`}
          >
            {isSubmitting ? (
              'Saving...'
            ) : (
              <>
                <Check className={`w-4 h-4 mr-2 ${isMobile ? 'w-5 h-5' : ''}`} />
                Submit Readings
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}