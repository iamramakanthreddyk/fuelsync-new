/**
 * DataCard Component
 * A reusable card for displaying data items with header and content
 * Used in Reports for Nozzles, Pumps, Shifts, Sales
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface DataCardProps {
  /** Card title */
  title: string;
  /** Card subtitle/description */
  subtitle?: string;
  /** Badge configuration */
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    className?: string;
  };
  /** Right side header content (e.g., totals) */
  headerRight?: React.ReactNode;
  /** Card content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Whether to use compact padding */
  compact?: boolean;
}

export const DataCard: React.FC<DataCardProps> = ({
  title,
  subtitle,
  badge,
  headerRight,
  children,
  className,
  compact = false,
}) => {
  return (
    <Card className={cn(className)}>
      <CardHeader className={compact ? 'pb-3' : undefined}>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className={compact ? 'text-base' : 'text-lg'}>
              {title}
            </CardTitle>
            {subtitle && (
              <CardDescription className={compact ? 'text-xs' : undefined}>
                {subtitle}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            {badge && (
              <Badge 
                variant={badge.variant || 'outline'} 
                className={badge.className}
              >
                {badge.text}
              </Badge>
            )}
            {headerRight}
          </div>
        </div>
      </CardHeader>
      <CardContent className={compact ? 'space-y-3' : undefined}>
        {children}
      </CardContent>
    </Card>
  );
};

/**
 * DataRow Component
 * A reusable row item for displaying data in a muted background
 */
export interface DataRowProps {
  /** Left side content */
  left: React.ReactNode;
  /** Right side content */
  right?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const DataRow: React.FC<DataRowProps> = ({ left, right, className }) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 bg-muted rounded-lg',
        className
      )}
    >
      {left}
      {right}
    </div>
  );
};

/**
 * MetricGrid Component
 * A responsive grid for displaying metric values
 */
export interface MetricGridProps {
  /** Array of metrics to display */
  metrics: Array<{
    label: string;
    value: string | number;
    className?: string;
  }>;
  /** Number of columns */
  columns?: 2 | 3 | 4;
  /** Additional CSS classes */
  className?: string;
}

export const MetricGrid: React.FC<MetricGridProps> = ({
  metrics,
  columns = 2,
  className,
}) => {
  const colClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div className={cn('grid gap-3', colClasses[columns], className)}>
      {metrics.map((metric, index) => (
        <div key={index}>
          <p className="text-xs text-muted-foreground">{metric.label}</p>
          <p className={cn('text-lg font-bold', metric.className)}>
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
};

export default DataCard;
