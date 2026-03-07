/**
 * Tank Levels Snapshot Card
 * Shows a quick overview of fuel tank levels across all stations
 * - Color-coded status (green, yellow, red)
 * - Compact list view
 * Link to full inventory management
 */

import { useStations } from '@/hooks/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Fuel, ChevronRight, AlertTriangle } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { apiClient, ApiResponse } from '@/lib/api-client';
import type { Tank } from '@/types/api';
import { getFuelColorScheme } from '@/core/fuel/fuelConfig';

interface TankSnapshot {
  fuelType: string;
  displayFuelName: string;
  currentLevel: number;
  capacity: number;
  percentFull: number;
  status: 'critical' | 'low' | 'normal' | 'overflow';
  fuelColors: {
    bg: string;
    text: string;
    border: string;
    dot: string;
    bar: string;
  };
}

export function TankLevelsSnapshot() {
  const { data: stationsResponse } = useStations();
  const stations = useMemo(() => stationsResponse?.data || [], [stationsResponse?.data]);

  const [allTanks, setAllTanks] = useState<TankSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tanks for each station
  useEffect(() => {
    if (stations.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const fetchAllTanks = async () => {
      try {
        const tanks: TankSnapshot[] = [];

        for (const station of stations) {
          try {
            // Correct endpoint: /api/v1/stations/:stationId/tanks
            const data: ApiResponse<Tank[]> = await apiClient.get(`/stations/${station.id}/tanks`);
            
            if (data.success && Array.isArray(data.data)) {
              data.data.forEach((tank: Tank) => {
                try {
                  const currentLevel = tank.currentLevel;
                  const capacity = tank.capacity;
                  const percentFull = Math.round((currentLevel / capacity) * 100);
                  const fuelColors = getFuelColorScheme(tank.fuelType);

                  let status: 'critical' | 'low' | 'normal' | 'overflow' = 'normal';
                  if (percentFull <= 10) status = 'critical';
                  else if (percentFull <= 20) status = 'low';
                  else if (percentFull > 100) status = 'overflow';

                  tanks.push({
                    fuelType: tank.fuelType,
                    displayFuelName: tank.displayFuelName || tank.fuelType,
                    currentLevel,
                    capacity,
                    percentFull,
                    status,
                    fuelColors: {
                      ...fuelColors,
                      bar: fuelColors.dot,
                    },
                  });
                } catch (err) {
                  console.error('Error transforming tank data:', err);
                }
              });
            }
          } catch (err) {
            console.error(`Failed to fetch tanks for station ${station.id}:`, err);
          }
        }

        setAllTanks(tanks);
      } catch (err) {
        console.error('Error fetching tanks:', err);
        setError('Failed to load tank levels');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllTanks();
  }, [stations]);

  const criticalTanks = allTanks.filter(t => t.status === 'critical').length;
  const lowTanks = allTanks.filter(t => t.status === 'low').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Fuel className="w-5 h-5" />
            Tank Levels Overview
          </CardTitle>
          {(criticalTanks > 0 || lowTanks > 0) && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
              {criticalTanks > 0 ? `${criticalTanks} Critical` : `${lowTanks} Low`}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-sm text-muted-foreground">Loading tanks...</div>
        ) : error ? (
          <div className="text-center py-4 text-sm text-red-600">{error}</div>
        ) : allTanks.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No tanks configured. Set up fuel tanks in Inventory.
          </div>
        ) : (
          <div className="space-y-3">
            {allTanks.slice(0, 6).map((tank, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-gray-700">{tank.displayFuelName}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${tank.fuelColors.text}`}>
                      {tank.percentFull}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${tank.fuelColors.bar} transition-all`}
                    style={{ width: `${Math.min(tank.percentFull, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  {tank.currentLevel.toFixed(0)}L / {tank.capacity.toFixed(0)}L
                </div>
              </div>
            ))}
          </div>
        )}

        {allTanks.length > 6 && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            +{allTanks.length - 6} more tanks
          </div>
        )}

        {criticalTanks > 0 && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{criticalTanks} tank(s) critically low - plan refills</span>
          </div>
        )}

        <button className="w-full mt-3 p-2 text-sm text-primary hover:bg-gray-50 rounded flex items-center justify-center gap-1 border border-gray-200">
          View Full Inventory
          <ChevronRight className="w-4 h-4" />
        </button>
      </CardContent>
    </Card>
  );
}
