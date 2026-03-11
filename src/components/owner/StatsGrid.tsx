import { Card, CardContent } from '@/components/ui/card';
import { Building2, Users, IndianRupee, TrendingUp } from 'lucide-react';

interface StatsGridProps {
  stats: {
    totalStations?: number;
    activeStations?: number;
    totalEmployees?: number;
    todaySales?: number;
    monthSales?: number;
  } | null;
  isLoading: boolean;
}

export function StatsGrid({ stats, isLoading }: StatsGridProps) {
  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <Card className="bg-white border-blue-200 dark:bg-blue-950/20 shadow-sm">
      <CardContent className="py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {/* Stations */}
          <div className="flex flex-col items-center">
            <div className="mb-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xs text-muted-foreground">Stations</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {isLoading ? '...' : stats?.totalStations ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {isLoading ? '...' : stats?.activeStations ?? 0} active
            </div>
          </div>

          {/* Employees */}
          <div className="flex flex-col items-center">
            <div className="mb-2 p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-xs text-muted-foreground">Employees</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {isLoading ? '...' : stats?.totalEmployees ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Across all stations</div>
          </div>

          {/* Today's Sales */}
          <div className="flex flex-col items-center">
            <div className="mb-2 p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <IndianRupee className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-xs text-muted-foreground">Today's Sales</div>
            <div className="text-xl font-bold text-green-600 dark:text-green-400 truncate">
              {isLoading ? '...' : formatCurrency(stats?.todaySales ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Combined total</div>
          </div>

          {/* Month Sales */}
          <div className="flex flex-col items-center">
            <div className="mb-2 p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-xs text-muted-foreground">Month Sales</div>
            <div className="text-xl font-bold text-orange-600 dark:text-orange-400 truncate">
              {isLoading ? '...' : formatCurrency(stats?.monthSales ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Current month</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
