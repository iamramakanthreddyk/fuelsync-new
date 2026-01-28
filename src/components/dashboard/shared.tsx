import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, IndianRupee, Clock, AlertTriangle, Fuel, Users, Building2, Package } from "lucide-react";
import { safeToFixed } from '@/lib/format-utils';
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'orange';
  className?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'success' | 'warning' | 'danger' | 'info';
}

export function MetricCard({
  title,
  value,
  description,
  icon,
  color,
  className,
  trend,
  trendValue,
  variant
}: MetricCardProps) {
  // Override color based on variant if provided
  const effectiveColor = variant ? 
    (variant === 'success' ? 'green' : 
     variant === 'warning' ? 'amber' : 
     variant === 'danger' ? 'red' : 
     variant === 'info' ? 'blue' : color) : color;

  const colorClasses = {
    green: 'border-l-green-500 text-green-600',
    blue: 'border-l-blue-500 text-blue-600',
    amber: 'border-l-amber-500 text-amber-600',
    red: 'border-l-red-500 text-red-600',
    purple: 'border-l-purple-500 text-purple-600',
    orange: 'border-l-orange-500 text-orange-600'
  };

  return (
    <Card className={cn(
      "card-mobile border-l-4 hover:scale-[1.01] transition-all duration-200 brand-border",
      colorClasses[effectiveColor],
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground brand-text">
          {title}
        </CardTitle>
        <div className={cn("h-4 w-4 sm:h-5 sm:w-5", effectiveColor === 'green' ? 'text-green-600' : effectiveColor === 'blue' ? 'text-blue-600' : effectiveColor === 'amber' ? 'text-amber-600' : effectiveColor === 'red' ? 'text-red-600' : effectiveColor === 'purple' ? 'text-purple-600' : 'text-orange-600')}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className={cn(
          "text-xl sm:text-2xl font-bold",
          effectiveColor === 'green' ? 'text-green-600' : effectiveColor === 'blue' ? 'text-blue-600' : effectiveColor === 'amber' ? 'text-amber-600' : effectiveColor === 'red' ? 'text-red-600' : effectiveColor === 'purple' ? 'text-purple-600' : 'text-orange-600'
        )}>
          {typeof value === 'number' && value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value}
        </div>
        <p className="text-xs text-muted-foreground mt-1 brand-text">
          {description}
        </p>
        {trend && trendValue && (
          <div className={cn(
            "text-xs mt-1 font-medium",
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
          )}>
            {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'} {trendValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardHeader({
  title,
  subtitle,
  userName,
  rightContent
}: {
  title: string;
  subtitle?: string;
  userName?: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-foreground brand-text">
            {title}
          </h1>
          {subtitle && (
            <p className="text-responsive-sm text-muted-foreground brand-text">
              {subtitle}
              {userName && <span className="font-medium text-foreground"> {userName}</span>}
            </p>
          )}
        </div>
        {rightContent && (
          <div className="w-full sm:w-auto sm:ml-auto sm:flex-shrink-0">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardGrid({
  metrics,
  cols = { default: 1, sm: 2, lg: 3, xl: 4 }
}: {
  metrics?: Array<{
    title: string;
    value: string | number;
    description: string;
    icon: React.ReactNode;
    color: 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'orange';
    className?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    variant?: 'success' | 'warning' | 'danger' | 'info';
  }>;
  cols?: { default?: number; sm?: number; md?: number; lg?: number; xl?: number };
}) {
  const gridClasses = [
    cols.default && `grid-cols-${cols.default}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`
  ].filter(Boolean).join(' ');

  return (
    <div className={cn("grid gap-3 sm:gap-4", gridClasses)}>
      {metrics?.map((metric, index) => (
        <MetricCard
          key={index}
          title={metric.title}
          value={metric.value}
          description={metric.description}
          icon={metric.icon}
          color={metric.color}
          className={metric.className}
          trend={metric.trend}
          trendValue={metric.trendValue}
        />
      ))}
    </div>
  );
}

// Common metric configurations
export const COMMON_METRICS = {
  sales: {
    title: "Total Sales Today",
    icon: <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />,
    color: 'green' as const,
    description: "From fuel dispensing"
  },
  payments: {
    title: "Total Payments",
    icon: <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />,
    color: 'blue' as const,
    description: "Cash, card, UPI & credit"
  },
  closures: {
    title: "Pending Closures",
    icon: <Clock className="h-4 w-4 sm:h-5 sm:w-5" />,
    color: 'amber' as const,
    description: (count: number) => count > 0 ? 'Need attention' : 'All closed'
  },
  variance: {
    title: "Daily Variance",
    icon: <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />,
    color: 'purple' as const,
    description: (variance: number) => {
      if (Math.abs(variance) < 1) return 'Sales match collections';
      return variance > 0 ? 'Collection excess' : 'Collection shortage';
    }
  },
  users: {
    title: "Total Users",
    icon: <Users className="h-4 w-4 sm:h-5 sm:w-5" />,
    color: 'blue' as const,
    description: "Active users"
  },
  stations: {
    title: "Total Stations",
    icon: <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />,
    color: 'green' as const,
    description: "Active stations"
  },
  fuel: {
    title: "Fuel Dispensed",
    icon: <Fuel className="h-4 w-4 sm:h-5 sm:w-5" />,
    color: 'orange' as const,
    description: "Litres today"
  },
  plans: {
    title: "Active Plans",
    icon: <Package className="h-4 w-4 sm:h-5 sm:w-5" />,
    color: 'purple' as const,
    description: "Subscription plans"
  }
};