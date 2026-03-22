import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ReadingInput } from '@/components/ui/ReadingInput';
import { Check } from 'lucide-react';
import { safeToFixed } from '@/lib/format-utils';
import { getFuelBadgeClasses } from '@/lib/fuelColors';
import { EquipmentStatusEnum } from '@/core/enums';
import type { ReadingEntry } from '@/types/finance';

export interface NozzleReadingRowProps {
  nozzle: any;
  readings: Record<string, ReadingEntry>;
  handleReadingChange: (nozzleId: string, value: string) => void;
  handleSampleChange: (nozzleId: string, isSample: boolean) => void;
  hasPriceForFuelType: (fuelType: string) => boolean;
  lastReading?: number | null;
  lastReadingLoading?: boolean;
  // Optional sale calculation display
  showSaleCalculation?: boolean;
  litres?: number;
  saleValue?: number;
}

export const NozzleReadingRow: React.FC<NozzleReadingRowProps> = ({
  nozzle,
  readings,
  handleReadingChange,
  handleSampleChange,
  hasPriceForFuelType,
  lastReading,
  lastReadingLoading,
  showSaleCalculation = false,
  litres = 0,
  saleValue = 0,
}) => {
  const initialReading = nozzle.initialReading ? parseFloat(String(nozzle.initialReading)) : null;
  // Priority: use passed-in lastReading prop first, then nozzle's lastReading, then fallback to initialReading
  const effectiveLastReading = (lastReading !== null && lastReading !== undefined) 
    ? lastReading
    : (nozzle.lastReading !== null && nozzle.lastReading !== undefined ? nozzle.lastReading : null);
  const parsedLastReading = (effectiveLastReading !== null && effectiveLastReading !== undefined) ? parseFloat(String(effectiveLastReading)) : null;
  const compareValue = (parsedLastReading !== null && !isNaN(parsedLastReading))
    ? parsedLastReading
    : (initialReading !== null && !isNaN(initialReading) ? initialReading : 0);
  const reading = readings[nozzle.id];
  const enteredValue = reading?.readingValue !== undefined && reading?.readingValue !== '' ? parseFloat(reading.readingValue) : undefined;
  const hasFuelPrice = hasPriceForFuelType(nozzle.fuelType);
  
  const nozzleStatus = (nozzle.status || 'active').toLowerCase().trim();
  const isNozzleActive = nozzleStatus === EquipmentStatusEnum.ACTIVE || nozzleStatus === 'active';
  const isMaintenance = nozzleStatus === EquipmentStatusEnum.MAINTENANCE || nozzleStatus === 'maintenance';
  const isInactive = nozzleStatus === EquipmentStatusEnum.INACTIVE || nozzleStatus === 'inactive' || (nozzleStatus && !isNozzleActive && !isMaintenance);

  return (
    <div className={`border rounded-lg p-2 sm:p-4 bg-white transition-colors ${
      isNozzleActive ? 'border-brand-200 hover:bg-brand-50' : 'border-orange-200 bg-orange-50/30'
    }`}>
      {/* Header */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="outline" className="text-xs font-semibold px-1.5 py-0.5 sm:px-2 sm:py-1 border-brand-300 whitespace-nowrap">
            #{nozzle.nozzleNumber}
          </Badge>
          <Badge className={`${getFuelBadgeClasses(nozzle.fuelType)} text-xs font-semibold px-1.5 py-0.5 sm:px-2 sm:py-1 whitespace-nowrap`}>
            {nozzle.fuelType}
          </Badge>
          
          {/* Nozzle Status Badge - Always show status */}
          <Badge 
            variant={isNozzleActive ? 'default' : isMaintenance ? 'secondary' : 'destructive'} 
            className="text-xs font-semibold px-1.5 py-0.5 sm:px-2 sm:py-1 whitespace-nowrap">
            {nozzleStatus ? nozzleStatus.charAt(0).toUpperCase() + nozzleStatus.slice(1).toLowerCase() : 'UNKNOWN'}
          </Badge>
          
          {!hasFuelPrice && isNozzleActive && (
            <span className="text-red-600 text-xs font-bold bg-red-50 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded whitespace-nowrap">⚠ No price</span>
          )}
        </div>
        <div className="text-left">
          <div className="text-xs text-brand-500 font-medium">Previous</div>
          {lastReadingLoading ? (
            <div className="animate-pulse h-7 w-20 bg-brand-200 rounded"></div>
          ) : (
            <div className="text-base sm:text-lg font-bold text-brand-900 break-words">{safeToFixed(compareValue, 1)} L</div>
          )}
        </div>
      </div>
      {/* Input Section */}
      <div className={showSaleCalculation ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-2"}>
        <div className="space-y-2">
          <div className="relative">
            <ReadingInput
              value={reading?.readingValue !== undefined && reading?.readingValue !== null ? reading.readingValue : ''}
              onChange={(val: string) => handleReadingChange(nozzle.id, val)}
              disabled={!isNozzleActive || !hasFuelPrice}
              placeholder="Current reading"
              className={`text-base sm:text-sm h-10 sm:h-9 font-semibold w-full break-words overflow-hidden ${!hasFuelPrice ? 'border-red-300 bg-red-50 text-red-900' : 'border-brand-300 text-brand-900'}`}
            />
            {reading?.readingValue && !lastReadingLoading && enteredValue !== undefined && isNozzleActive && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {enteredValue > compareValue ? (
                  <Check className="w-5 h-5 text-emerald-600 font-bold" />
                ) : (
                  <span className="text-xs text-red-700 font-bold">Invalid</span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Sale Calculation Display (optional) */}
        {showSaleCalculation && (
          <div className="text-right">
            {reading?.readingValue && enteredValue !== undefined && enteredValue > compareValue ? (
              <div>
                <p className="text-sm text-gray-600">
                  {safeToFixed(litres, 2)} L
                </p>
                <p className="font-semibold text-green-600">
                  ₹{safeToFixed(saleValue, 2)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No sale</p>
            )}
          </div>
        )}
      </div>
      
      {/* Sample Reading Checkbox */}
      <div className={`mt-3 p-3 rounded-lg border-2 ${isNozzleActive ? 'bg-brand-50 border-brand-200' : 'bg-gray-100 border-gray-300'}`}>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={reading?.is_sample || false}
            onChange={(e) => handleSampleChange(nozzle.id, e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-brand-600 cursor-pointer flex-shrink-0"
            disabled={!isNozzleActive || !hasFuelPrice}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-brand-900">Quality Check / Sample Reading</p>
            <p className="text-xs text-brand-700 mt-0.5">Mark this if fuel was tested and returned to tank</p>
          </div>
        </label>
      </div>
      
      {/* Status Warning Messages - Always show if NOT active */}
      {!isNozzleActive && (
        <div className={`mt-2 p-2.5 rounded-lg border-2 ${
          isMaintenance 
            ? 'bg-orange-50 border-orange-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <p className={`text-xs font-bold ${
            isMaintenance
              ? 'text-orange-700'
              : 'text-red-700'
          }`}>
            {isMaintenance 
              ? '🔧 This nozzle is in MAINTENANCE - Data entry disabled' 
              : isInactive 
              ? '❌ This nozzle is INACTIVE - Data entry disabled'
              : `⚠️ This nozzle status is "${nozzleStatus.toUpperCase()}" - Data entry disabled`}
          </p>
        </div>
      )}
      
      {/* Missing Fuel Price Warning */}
      {!hasFuelPrice && isNozzleActive && (
        <div className="mt-2 p-2.5 bg-red-50 rounded-lg border-2 border-red-200">
          <p className="text-xs text-red-700 font-bold">
            ⚠️ Set fuel price in Prices page
          </p>
        </div>
      )}
    </div>
  );
};
