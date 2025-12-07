/**
 * PricesRequiredAlert Component
 * 
 * Shows a prominent alert when fuel prices are not set
 * Prevents users from entering readings without prices
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFuelPricesStatus } from '@/hooks/useFuelPricesStatus';
import { useRoleAccess } from '@/hooks/useRoleAccess';

interface PricesRequiredAlertProps {
  stationId?: string;
  showIfMissing?: boolean;
  compact?: boolean;
  onSetPrices?: () => void;
}

/**
 * Shows alert if prices are not set
 * Can be used to block reading entry or show as warning
 */
export function PricesRequiredAlert({
  stationId,
  showIfMissing = true,
  compact = false,
  onSetPrices
}: PricesRequiredAlertProps) {
  const navigate = useNavigate();
  const { hasPrices, missingFuelTypes, warning, isLoading } = useFuelPricesStatus(stationId);
  const { stations } = useRoleAccess();
  
  // Find station name from stationId
  const stationName = stationId ? stations.find(s => s.id === stationId)?.name : null;

  // Don't show alert while loading or if no station is selected
  if (isLoading || !showIfMissing || hasPrices || !stationId) {
    return null;
  }

  if (compact) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Fuel Prices Required</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>
            {warning || 'Fuel prices must be set before entering readings'}
            {stationName && <span className="block text-xs mt-1 opacity-75">Station: {stationName}</span>}
          </span>
          <Button 
            size="sm" 
            variant="outline"
            onClick={onSetPrices || (() => navigate('/prices'))}
          >
            Set Prices
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className="mb-6 border-l-4">
      <AlertCircle className="h-5 w-5" />
      <AlertTitle className="text-lg">Fuel Prices Not Set</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>
          You cannot enter fuel readings without setting fuel prices first. 
          {missingFuelTypes.length > 0 && (
            <span> Missing prices for: <strong>{missingFuelTypes.join(', ')}</strong></span>
          )}
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={onSetPrices || (() => navigate('/prices'))}
            className="gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Set Fuel Prices Now
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate('/prices')}
          >
            View Prices Page
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Hook to use in pages to check if prices are set before allowing actions
 */
export function usePricesRequired() {
  const { hasPrices, canEnterReadings, warning } = useFuelPricesStatus();
  return {
    pricesSet: hasPrices,
    canProceed: canEnterReadings,
    warning
  };
}
