import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Building2, Fuel } from 'lucide-react';
import { NavigateFunction } from 'react-router-dom';

interface SetupWarningsAlertProps {
  hasStations: boolean;
  hasFuelPrices: boolean;
  navigate: NavigateFunction;
}

export function SetupWarningsAlert({ hasStations, hasFuelPrices, navigate }: SetupWarningsAlertProps) {
  const warnings = [];

  if (!hasStations) {
    warnings.push({
      icon: Building2,
      title: 'No stations configured',
      description: 'Add your first fuel station to get started',
      action: () => navigate('/owner/stations'),
      actionLabel: 'Add Station'
    });
  }

  if (hasStations && !hasFuelPrices) {
    warnings.push({
      icon: Fuel,
      title: 'Fuel prices not set',
      description: 'Set fuel prices for your stations to enable sales tracking',
      action: () => navigate('/owner/stations'),
      actionLabel: 'Set Prices'
    });
  }

  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {warnings.map((warning, idx) => {
        const IconComponent = warning.icon;
        return (
          <Alert key={idx} className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <IconComponent className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm text-amber-900 dark:text-amber-200">
                    {warning.title}
                  </div>
                  <div className="text-xs text-amber-800 dark:text-amber-300">
                    {warning.description}
                  </div>
                </div>
              </div>
              <Button 
                onClick={warning.action} 
                size="sm" 
                variant="outline"
                className="flex-shrink-0"
              >
                {warning.actionLabel}
              </Button>
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
