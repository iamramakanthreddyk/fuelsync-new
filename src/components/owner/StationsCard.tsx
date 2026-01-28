/**
 * StationsCard - Stations list with header
 * Displays the full stations card with header, count badge, and station items
 */

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';
import { StationsList } from './StationsList';
import { NavigateFunction } from 'react-router-dom';

interface Station {
  id: string;
  name: string;
  code?: string;
  pumpCount?: number;
  activePumps?: number;
  todaySales?: number;
  lastReading?: string;
}

interface StationsCardProps {
  stations: Station[];
  isLoading: boolean;
  navigate: NavigateFunction;
}

export function StationsCard({ stations, isLoading, navigate }: StationsCardProps) {
  return (
    <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm">Your Stations</CardTitle>
            {Array.isArray(stations) && stations.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {stations.length}
              </Badge>
            )}
          </div>
          {stations.length > 0 && (
            <div className="flex gap-1">
              <Button
                onClick={() => navigate(`/owner/daily-settlement/${stations[0].id}`)}
                variant="outline"
                size="sm"
                className="px-2 py-1 text-xs border-green-200 text-green-700 hover:bg-green-50"
              >
                Settlement
              </Button>
              <Button
                onClick={() => navigate(`/owner/stations/${stations[0].id}`)}
                variant="outline"
                size="sm"
                className="px-2 py-1 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                Manage
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <StationsList stations={stations} isLoading={isLoading} navigate={navigate} />
    </Card>
  );
}
