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
    <Card className="hover:shadow-xl transition-all duration-300 border-t-4 border-t-primary shadow-md">
      <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Your Stations</CardTitle>
                {Array.isArray(stations) && stations.length > 0 && (
                  <Badge variant="secondary" className="mt-1">{stations.length} stations</Badge>
                )}
              </div>
            </div>
            <CardDescription className="text-sm ml-11">
              Performance overview and management
            </CardDescription>
          </div>
          {stations.length > 0 && (
            <div className="flex gap-4">
              <Button
                onClick={() => navigate(`/owner/daily-settlement/${stations[0].id}`)}
                size="sm"
                className="px-6 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-lg"
                variant="default"
              >
                Settle
              </Button>
              <Button
                onClick={() => navigate(`/owner/stations/${stations[0].id}`)}
                size="sm"
                className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg"
                variant="default"
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
