/**
 * Consistent fuel type badge component
 * Displays fuel type with appropriate color coding
 */

import { Badge } from '@/components/ui/badge';
import { getFuelBadgeClasses } from '@/lib/fuelColors';

interface FuelBadgeProps {
  fuelType?: string;
  className?: string;
  showDot?: boolean;
}

export function FuelBadge({ fuelType, className = '', showDot = false }: FuelBadgeProps) {
  if (!fuelType) {
    return null;
  }

  return (
    <Badge className={`${getFuelBadgeClasses(fuelType)} ${className}`}>
      {showDot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      )}
      {fuelType}
    </Badge>
  );
}
