/**
 * FuelBadge Component - Updated to use centralized fuel configuration
 *
 * Consistent fuel type display with colors and optional dot indicator.
 * Uses the centralized fuel configuration for colors and labels.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getFuelBadgeClasses, getFuelTypeLabel, getFuelTypeShortLabel } from '@/core/fuel/fuelConfig';
import { cn } from '@/lib/utils';

interface FuelBadgeProps {
  /** Fuel type identifier */
  fuelType?: string;
  /** Show colored dot indicator */
  showDot?: boolean;
  /** Use short label instead of full label */
  short?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Badge variant */
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

/**
 * FuelBadge Component
 *
 * Consistent fuel type display with colors and optional dot indicator.
 * Uses the centralized fuel configuration for colors and labels.
 */
export function FuelBadge({
  fuelType,
  showDot = false,
  short = false,
  className,
  variant = 'default'
}: FuelBadgeProps) {
  if (!fuelType) return null;

  const label = short ? getFuelTypeShortLabel(fuelType) : getFuelTypeLabel(fuelType);
  const badgeClasses = getFuelBadgeClasses(fuelType);

  return (
    <Badge
      variant={variant}
      className={cn(
        badgeClasses,
        showDot && 'flex items-center gap-1.5',
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            // Extract dot color from the badge classes
            badgeClasses.includes('bg-') ?
              badgeClasses.split(' ')[0]?.replace('bg-', 'bg-') || 'bg-gray-500' :
              'bg-gray-500'
          )}
        />
      )}
      {label}
    </Badge>
  );
}

export default FuelBadge;
