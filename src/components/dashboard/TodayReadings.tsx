import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Fuel, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { safeToFixed } from '@/lib/format-utils';
import { useAuth } from '@/hooks/useAuth';
import { FuelType } from '@/core/enums';

interface TodayReadingsProps {
  className?: string;
}

export function TodayReadings({ className }: TodayReadingsProps) {
  const { user } = useAuth();
  const [readings, setReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const currentStation = user?.stations?.[0];

  useEffect(() => {
    const fetchTodayReadings = async () => {
      if (!currentStation) {
        setLoading(false);
        return;
      }

      try {
        const todayReadings = await apiClient.get<any[]>(`/api/v1/readings/today?stationId=${currentStation.id}`);
        setReadings(todayReadings || []);
      } catch (error) {
        console.error('Error fetching today\'s readings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayReadings();
  }, [currentStation]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today's Readings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (readings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today's Readings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No readings recorded today
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalLitres = readings.reduce((sum, reading) => sum + reading.litresSold, 0);
  const totalAmount = readings.reduce((sum, reading) => sum + reading.totalAmount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Today's Readings ({readings.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-xl font-bold text-blue-600">{readings.length}</div>
            <div className="text-sm text-muted-foreground">Readings</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-xl font-bold text-green-600">{safeToFixed(totalLitres, 1)}L</div>
            <div className="text-sm text-muted-foreground">Total Litres</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-xl font-bold text-purple-600">₹{totalAmount.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total Amount</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-xl font-bold text-orange-600">₹{safeToFixed(totalAmount / Math.max(totalLitres, 1), 2)}</div>
            <div className="text-sm text-muted-foreground">Avg Price/L</div>
          </div>
        </div>

        {/* Readings List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {readings.map((reading) => (
            <div key={reading.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {reading.nozzle?.pump?.name || 'Pump'} - Nozzle {reading.nozzle?.number || '?'}
                    </Badge>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {reading.fuelType}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {new Date(reading.readingDate).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">₹{reading.totalAmount.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">
                  {safeToFixed(reading.litresSold, 2)}L @ ₹{reading.pricePerLitre}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}