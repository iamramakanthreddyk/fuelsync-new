import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { readingService } from '@/services/readingService';
import { FuelBadge } from '@/components/FuelBadge';
import { Clock, User, TrendingUp } from 'lucide-react';
import { NozzleReading } from '@/types/api';
import { safeToFixed } from '@/lib/format-utils';

export function TodayReadings() {
  const { data: readings, isLoading, error } = useQuery({
    queryKey: ['today-readings'],
    queryFn: () => readingService.getTodayReadings(''),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Today's Readings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Loading today's readings...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Today's Readings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-red-500">
            Failed to load today's readings
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalReadings = readings?.length || 0;
  const totalLitres = readings?.reduce((sum, r) => sum + Number(r.litresSold || 0), 0) || 0;
  const totalAmount = readings?.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0) || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Today's Readings
        </CardTitle>
        <CardDescription>
          {totalReadings} readings • {safeToFixed(totalLitres, 1)}L • ₹{safeToFixed(totalAmount, 2)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalReadings === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No readings entered today yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {readings?.map((reading: NozzleReading) => (
              <div
                key={reading.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        Pump {reading.nozzle?.pump?.pumpNumber || reading.nozzle?.pump?.name || 'Unknown'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        N{reading.nozzle?.nozzleNumber || '?'}
                      </span>
                      <FuelBadge fuelType={reading.fuelType} showDot />
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <User className="w-3 h-3" />
                      {reading.user?.name || reading.enteredByUser?.name || 'Unknown'}
                      <span>•</span>
                      {new Date(reading.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-semibold">
                    {safeToFixed(reading.currentReading, 2)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {safeToFixed(reading.litresSold || 0, 1)}L • ₹{safeToFixed(reading.totalAmount || 0, 2)}
                  </div>
                </div>

                <Badge variant="outline" className="text-xs">
                  {reading.isInitialReading ? 'Initial' : 'Sale'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}