
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
  gradient?: boolean;
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  gradient = false,
  className = ''
}) => {
  const getTrendColor = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return 'text-fuel-success bg-fuel-success/10 border-fuel-success/20';
      case 'down':
        return 'text-fuel-error bg-fuel-error/10 border-fuel-error/20';
      default:
        return 'text-fuel-warning bg-fuel-warning/10 border-fuel-warning/20';
    }
  };

  const getTrendSymbol = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return '↗️';
      case 'down':
        return '↘️';
      default:
        return '➡️';
    }
  };

  return (
    <Card className={`relative overflow-hidden card-mobile hover:scale-[1.02] active:scale-[0.98] ${className}`}>
      {gradient && (
        <div className="absolute inset-0 fuel-gradient opacity-5" />
      )}
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 relative z-10">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="text-xl sm:text-2xl">
            {icon}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="relative z-10 px-4 pb-4 sm:px-6">
        <div className="space-y-2">
          <div className="text-xl sm:text-2xl font-bold text-foreground break-words">
            {value}
          </div>
          
          {subtitle && (
            <p className="text-xs text-muted-foreground">
              {subtitle}
            </p>
          )}
          
          {trend && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="outline" 
                className={`text-xs px-2 py-1 ${getTrendColor(trend.direction)}`}
              >
                <span className="mr-1">{getTrendSymbol(trend.direction)}</span>
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </Badge>
              <span className="text-xs text-muted-foreground">
                {trend.label}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MetricCard;
