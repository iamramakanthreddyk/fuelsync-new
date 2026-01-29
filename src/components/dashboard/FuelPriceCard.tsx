import React from 'react';
import { Fuel, IndianRupee, AlertCircle, Info } from 'lucide-react';
import { getFuelColors } from '@/lib/fuelColors';
import { safeToFixed } from '@/lib/format-utils';
import { useNavigate } from 'react-router-dom';

interface FuelPriceCardProps {
  prices: {
    PETROL?: number;
    DIESEL?: number;
    CNG?: number;
    EV?: number;
  };
  isLoading?: boolean;
  showWarning?: boolean;
  /** If false, user cannot set prices (e.g., employee) - show info instead of action */
  canSetPrices?: boolean;
  onSetPrices?: () => void;
}

export const FuelPriceCard: React.FC<FuelPriceCardProps> = ({
  prices,
  isLoading = false,
  showWarning = true,
  canSetPrices = true,
  onSetPrices,
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="w-full sm:w-auto min-w-0 flex items-center gap-2 px-3 py-2 bg-transparent sm:bg-muted/30 rounded-lg border-0 sm:border animate-pulse">
        <Fuel className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-xs sm:text-sm text-muted-foreground">Loading prices...</span>
      </div>
    );
  }

  // Derive displayed fuel types from the `prices` object keys so the UI
  // reflects whatever the API returns (e.g. PETROL, PREMIUM_PETROL, CNG).
  const setPrices = Object.keys(prices || {}).map((key) => {
    // Convert e.g. 'PREMIUM_PETROL' or 'EV_CHARGING' to human-friendly label
    const label = key
      .toString()
      .toLowerCase()
      .replace(/_/g, ' ')
      .split(' ')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');

    return { key, label };
  }).filter(({ key }) => prices[key as keyof typeof prices] !== undefined && prices[key as keyof typeof prices] !== null);

  if (setPrices.length === 0) {
    // If user can set prices and showWarning is true, show actionable warning
    if (showWarning && canSetPrices) {
      return (
        <div
          onClick={() => onSetPrices?.() || navigate('/prices')}
          className="w-full sm:w-auto min-w-0 flex items-center gap-2 px-3 py-2 bg-transparent sm:bg-red-50 rounded-lg border-0 sm:border sm:border-red-200 cursor-pointer hover:bg-transparent sm:hover:bg-red-100 transition-colors"
        >
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-red-700">Set fuel prices</span>
        </div>
      );
    }

    // For employees or when showWarning is false, show non-actionable info
    return (
      <div className="w-full sm:w-auto min-w-0 flex items-center gap-2 px-3 py-2 bg-transparent sm:bg-amber-50 rounded-lg border-0 sm:border sm:border-amber-200">
        <Info className="h-4 w-4 text-amber-600 flex-shrink-0" />
        <span className="text-xs sm:text-sm font-medium text-amber-700">
          {canSetPrices ? 'No fuel prices set' : 'Fuel prices not set by manager'}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full sm:w-auto min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-2 py-1 sm:px-3 sm:py-2 bg-transparent sm:bg-gradient-to-r sm:from-primary/5 sm:to-primary/10 rounded-md sm:rounded-lg border-0 sm:border sm:border-primary/20">
      <div className="flex items-center gap-1 flex-shrink-0">
        <Fuel className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground hidden sm:inline">Prices:</span>
        <span className="text-xs font-semibold text-foreground sm:hidden">Fuel Prices</span>
      </div>

      {/* Mobile: Horizontal scrollable layout */}
      <div className="flex gap-1 sm:hidden overflow-x-auto scrollbar-hide pb-0.5">
        {setPrices.map(({ key, label }) => {
          const colors = getFuelColors(label);
          return (
            <div
              key={key}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm flex-shrink-0 ${colors.ring} ring-1`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              <span className="text-xs font-bold flex items-center text-foreground">
                <IndianRupee className="w-2 h-2" />
                {(() => {
                  const v = prices[key as keyof typeof prices];
                  const num = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : NaN);
                  return !Number.isNaN(num) ? safeToFixed(num, 2) : 'N/A';
                })()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Desktop: Flex wrap layout */}
      <div className="hidden sm:flex sm:flex-wrap gap-1 sm:gap-2 min-w-0">
        {setPrices.map(({ key, label }) => {
          const colors = getFuelColors(label);
          return (
            <div
              key={key}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full bg-background border shadow-sm hover:shadow transition-all ${colors.ring} ring-1`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              <span className="text-xs font-bold flex items-center text-foreground">
                <IndianRupee className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                {(() => {
                  const v = prices[key as keyof typeof prices];
                  const num = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : NaN);
                  return !Number.isNaN(num) ? safeToFixed(num, 2) : 'N/A';
                })()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FuelPriceCard;
