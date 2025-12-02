/**
 * Stat Card Component
 * 
 * A specialized card for displaying statistics and KPIs.
 * 
 * @module core/components/ui/StatCard
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { Card, CardContent } from './Card';
import { safeToFixed } from '@/lib/format-utils';

// ============================================
// TYPES
// ============================================

export interface StatCardProps {
  /** Title/label of the stat */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Formatted value (if different from value) */
  formattedValue?: string;
  /** Change percentage */
  change?: number;
  /** Change label (e.g., "vs last month") */
  changeLabel?: string;
  /** Trend direction (auto-calculated from change if not provided) */
  trend?: 'up' | 'down' | 'neutral';
  /** Icon to display */
  icon?: LucideIcon;
  /** Icon background color */
  iconColor?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Loading state */
  loading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

// ============================================
// STYLES
// ============================================

const iconColorStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
  danger: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
};

const sizeStyles = {
  sm: {
    value: 'text-xl font-bold',
    title: 'text-xs',
    icon: 'h-8 w-8 p-1.5',
    iconSize: 'h-4 w-4',
    change: 'text-xs',
  },
  md: {
    value: 'text-2xl font-bold',
    title: 'text-sm',
    icon: 'h-10 w-10 p-2',
    iconSize: 'h-5 w-5',
    change: 'text-xs',
  },
  lg: {
    value: 'text-3xl font-bold',
    title: 'text-base',
    icon: 'h-12 w-12 p-2.5',
    iconSize: 'h-6 w-6',
    change: 'text-sm',
  },
};

// ============================================
// COMPONENT
// ============================================

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  formattedValue,
  change,
  changeLabel,
  trend: providedTrend,
  icon: Icon,
  iconColor = 'default',
  size = 'md',
  loading = false,
  className,
  onClick,
}) => {
  const styles = sizeStyles[size];
  
  // Determine trend from change if not provided
  const trend = providedTrend ?? (
    change === undefined ? undefined :
    change > 0 ? 'up' :
    change < 0 ? 'down' :
    'neutral'
  );

  // Get trend icon and color
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = 
    trend === 'up' ? 'text-green-600 dark:text-green-400' :
    trend === 'down' ? 'text-red-600 dark:text-red-400' :
    'text-muted-foreground';

  const displayValue = formattedValue ?? String(value);

  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-8 w-32 rounded bg-muted" />
              <div className="h-3 w-20 rounded bg-muted" />
            </div>
            {Icon && (
              <div className={cn('rounded-lg', styles.icon, 'bg-muted')} />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(onClick && 'cursor-pointer hover:shadow-md transition-shadow', className)}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className={cn('text-muted-foreground', styles.title)}>
              {title}
            </p>
            <p className={cn('tracking-tight', styles.value)}>
              {displayValue}
            </p>
            
            {change !== undefined && (
              <div className={cn('flex items-center gap-1', trendColor, styles.change)}>
                <TrendIcon className="h-3 w-3" />
                <span className="font-medium">
                  {change > 0 ? '+' : ''}{safeToFixed(change, 1)}%
                </span>
                {changeLabel && (
                  <span className="text-muted-foreground">
                    {changeLabel}
                  </span>
                )}
              </div>
            )}
          </div>

          {Icon && (
            <div
              className={cn(
                'rounded-lg flex items-center justify-center',
                styles.icon,
                iconColorStyles[iconColor]
              )}
            >
              <Icon className={styles.iconSize} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// STAT CARD GRID
// ============================================

export interface StatCardGridProps {
  /** Stat cards to display */
  children: React.ReactNode;
  /** Number of columns */
  columns?: 1 | 2 | 3 | 4;
  /** Additional CSS classes */
  className?: string;
}

export const StatCardGrid: React.FC<StatCardGridProps> = ({
  children,
  columns = 4,
  className,
}) => {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', columnClasses[columns], className)}>
      {children}
    </div>
  );
};

// ============================================
// MINI STAT
// ============================================

export interface MiniStatProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  className?: string;
}

export const MiniStat: React.FC<MiniStatProps> = ({
  label,
  value,
  icon: Icon,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {Icon && (
        <Icon className="h-4 w-4 text-muted-foreground" />
      )}
      <div className="flex items-baseline gap-1">
        <span className="font-semibold">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
};
