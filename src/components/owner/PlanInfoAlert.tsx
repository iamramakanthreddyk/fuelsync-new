import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Zap } from 'lucide-react';

export function PlanInfoAlert({ user, stats }) {
  const calculateProgress = (current: number, max: number) => Math.min((current / max) * 100, 100);
  return user.plan ? (
    <Alert className="border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
      <Zap className="h-4 w-4 text-blue-600 flex-shrink-0" />
      <AlertDescription className="text-xs sm:text-sm flex items-center justify-between flex-wrap gap-2">
        <div>
          <Badge variant="secondary" className="mr-2 bg-blue-600 text-white">
            {user.plan.name}
          </Badge>
          <span className="text-muted-foreground">
            {stats?.totalStations ?? 0}/{user.plan.maxStations} stations •
            {user.plan.maxPumpsPerStation} pumps/station •
            {stats?.totalEmployees ?? 0} employees
          </span>
        </div>
        {stats && user.plan.maxStations && (
          <div className="flex items-center gap-2">
            <Progress 
              value={calculateProgress(stats.totalStations, user.plan.maxStations)} 
              className="w-20 h-2"
            />
            <span className="text-xs text-muted-foreground">
              {calculateProgress(stats.totalStations, user.plan.maxStations).toFixed(0)}%
            </span>
          </div>
        )}
      </AlertDescription>
    </Alert>
  ) : null;
}
