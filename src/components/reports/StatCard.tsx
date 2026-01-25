/**
 * StatCard Component
 * A reusable gradient stat card for displaying key metrics
 * Used in Reports, Dashboards, and other analytics pages
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, Minus, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  /** Card title/label */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Trend percentage (optional) */
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  /** Icon component from lucide-react */
  icon?: LucideIcon;
  /** Gradient color scheme */
  variant?: 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'teal' | 'pink';
  /** Additional CSS classes */
  className?: string;
}

const variantStyles = {
  green: {
    bg: 'bg-gradient-to-br from-green-500 to-emerald-600',
    text: 'text-green-100',
    trendText: 'text-green-200',
    iconBg: 'bg-white/20',
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-500 to-cyan-600',
    text: 'text-blue-100',
    trendText: 'text-blue-200',
    iconBg: 'bg-white/20',
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-500 to-violet-600',
    text: 'text-purple-100',
    trendText: 'text-purple-200',
    iconBg: 'bg-white/20',
  },
  orange: {
    bg: 'bg-gradient-to-br from-orange-500 to-red-500',
    text: 'text-orange-100',
    trendText: 'text-orange-200',
    iconBg: 'bg-white/20',
  },
  red: {
    bg: 'bg-gradient-to-br from-red-500 to-rose-600',
    text: 'text-red-100',
    trendText: 'text-red-200',
    iconBg: 'bg-white/20',
  },
  teal: {
    bg: 'bg-gradient-to-br from-teal-500 to-cyan-600',
    text: 'text-teal-100',
    trendText: 'text-teal-200',
    iconBg: 'bg-white/20',
  },
  pink: {
    bg: 'bg-gradient-to-br from-pink-500 to-rose-600',
    text: 'text-pink-100',
    trendText: 'text-pink-200',
    iconBg: 'bg-white/20',
  },
};

const TrendIcon = ({ direction }: { direction: 'up' | 'down' | 'neutral' }) => {
  switch (direction) {
    case 'up':
      return <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 mr-1" />;
    case 'down':
      return <ArrowDownRight className="w-3 h-3 md:w-4 md:h-4 mr-1" />;
    default:
      return <Minus className="w-3 h-3 md:w-4 md:h-4 mr-1" />;
  }
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  trend,
  icon: Icon,
  variant = 'blue',
  className,
}) => {
  const styles = variantStyles[variant];

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 w-full',
        styles.bg,
        className
      )}
    >
      <CardContent className="p-3 sm:p-4 md:p-5">
        <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs sm:text-sm font-medium opacity-90', styles.text)}>
              {title}
            </p>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white truncate">
              {value}
            </p>
            {trend && (
              <div className="flex items-center mt-1">
                <TrendIcon direction={trend.direction} />
                <span className={cn('text-xs sm:text-sm', styles.trendText)}>
                  {trend.value >= 0 ? '+' : ''}
                  {trend.value}%
                </span>
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn('p-2 md:p-2.5 rounded-full flex-shrink-0', styles.iconBg)}>
              <Icon className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-white" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;
