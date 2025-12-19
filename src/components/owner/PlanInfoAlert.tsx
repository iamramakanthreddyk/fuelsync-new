import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Zap, Building2, Users, Fuel } from 'lucide-react';
import { formatPercentage } from '@/lib/format-utils';

import type { User } from '@/types/api';
interface PlanInfoAlertProps {
  user: User;
  stats?: {
    totalStations?: number;
    totalEmployees?: number;
  };
}
export function PlanInfoAlert({ user, stats }: PlanInfoAlertProps) {
  const calculateProgress = (current: number, max: number) => Math.min((current / max) * 100, 100);

  const stationUsage = stats?.totalStations ?? 0;
  const stationLimit = user.plan?.maxStations ?? 1;
  const progressPercent = calculateProgress(stationUsage, stationLimit);

  return user.plan ? (
    <Alert className="border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 dark:border-blue-800/50">
      <Zap className="h-4 w-4 text-blue-600 flex-shrink-0" />
      <AlertDescription className="text-xs sm:text-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Plan Info */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 font-medium">
              {user.plan.name}
            </Badge>

            <div className="flex items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                <span className="text-xs">
                  {stationUsage}/{stationLimit} stations
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Fuel className="h-3 w-3" />
                <span className="text-xs">
                  {user.plan.maxPumpsPerStation} pumps/station
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span className="text-xs">
                  {stats?.totalEmployees ?? 0} employees
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {stats && user.plan.maxStations && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex flex-col items-end gap-1">
                <Progress
                  value={progressPercent}
                  className="w-24 h-2 bg-blue-100 dark:bg-blue-900/30"
                />
                <span className="text-xs text-muted-foreground font-medium">
                  {progressPercent === 0 ? 'No stations' : formatPercentage(progressPercent - 100)}
                </span>
              </div>
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  ) : null;
}
