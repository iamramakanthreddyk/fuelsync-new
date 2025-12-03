import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, DollarSign, TrendingUp, Activity, CheckCircle2 } from 'lucide-react';

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
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Stations</CardTitle>
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
            {isLoading ? '...' : stats?.totalStations ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {isLoading ? '...' : stats?.activeStations ?? 0} active
            </Badge>
          </div>
        </CardContent>
      </Card>
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Employees</CardTitle>
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
            {isLoading ? '...' : stats?.totalEmployees ?? 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Across all stations</p>
        </CardContent>
      </Card>
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500 bg-gradient-to-br from-green-50/50 to-transparent dark:from-green-950/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Today's Sales</CardTitle>
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400 truncate">
            {isLoading ? '...' : formatCurrency(stats?.todaySales ?? 0)}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Activity className="w-3 h-3" />
            <span>Combined total</span>
          </div>
        </CardContent>
      </Card>
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50/50 to-transparent dark:from-orange-950/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Month Sales</CardTitle>
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400 truncate">
            {isLoading ? '...' : formatCurrency(stats?.monthSales ?? 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Current month</p>
        </CardContent>
      </Card>
    </div>
  );
}
