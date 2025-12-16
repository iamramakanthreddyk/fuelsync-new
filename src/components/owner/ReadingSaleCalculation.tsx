/**
 * Reading Sale Calculation Component
 * Shows per-nozzle sale value: (new reading - last reading) × fuel price
 */

import { Badge } from '@/components/ui/badge';
import { safeToFixed } from '@/lib/format-utils';
import { EquipmentStatusEnum } from '@/core/enums';

interface SaleCalculationProps {
  nozzleNumber: number;
  fuelType: string;
  lastReading: number;
  enteredReading: number;
  fuelPrice: number;
  status?: EquipmentStatusEnum;
}

export function ReadingSaleCalculation({
  nozzleNumber,
  fuelType,
  lastReading,
  enteredReading,
  fuelPrice,
  status = EquipmentStatusEnum.ACTIVE
}: SaleCalculationProps) {
  const litersDispensed = Math.max(0, enteredReading - lastReading);
  const saleValue = litersDispensed * fuelPrice;
  const isValid = enteredReading > lastReading && status === EquipmentStatusEnum.ACTIVE;

  return (
    <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg">
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm truncate max-w-[100px]">Nozzle {nozzleNumber}</span>
            <Badge variant="outline" className="text-xs truncate max-w-[80px]">
              {fuelType}
            </Badge>
          </div>
          {isValid && (
            <div className="text-xs font-bold text-green-600 whitespace-nowrap">
              ✓ Valid Reading
            </div>
          )}
        </div>

        {/* Calculation breakdown */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-2 bg-white rounded border overflow-x-auto">
            <div className="text-muted-foreground">New</div>
            <div className="font-bold text-primary break-all max-w-[90px] mx-auto">{safeToFixed(enteredReading, 2)}</div>
          </div>
          <div className="flex items-center justify-center text-muted-foreground">−</div>
          <div className="text-center p-2 bg-white rounded border overflow-x-auto">
            <div className="text-muted-foreground">Last</div>
            <div className="font-bold text-primary break-all max-w-[90px] mx-auto">{safeToFixed(lastReading, 2)}</div>
          </div>
        </div>

        {/* Result */}
        <div className="bg-white p-3 rounded-lg border-2 border-blue-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="truncate">
              <div className="text-xs text-muted-foreground mb-1">Liters Dispensed</div>
              <div className="text-lg font-bold text-blue-600 break-all max-w-[120px]">
                {safeToFixed(litersDispensed, 2)} L
              </div>
            </div>
            <div className="truncate">
              <div className="text-xs text-muted-foreground mb-1">Sale Value</div>
              <div className="text-lg font-bold text-green-600 break-all max-w-[120px]">
                ₹{safeToFixed(saleValue, 2)}
              </div>
              <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                @₹{safeToFixed(fuelPrice, 2)}/L
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
