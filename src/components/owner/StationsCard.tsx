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
      <CardHeader className="pb-3 sm:pb-4 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
        <div className="flex flex-col gap-4">
          {/* Title and Badge Section */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">Your Stations</CardTitle>
                  {Array.isArray(stations) && stations.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {stations.length} station{stations.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <CardDescription className="text-xs sm:text-sm ml-11 sm:ml-11">
            Performance overview and management
          </CardDescription>

          {/* Action Buttons - Compact Outline Style */}
          {stations.length > 0 && (
            <div className="flex flex-row gap-2 pt-2">
              <Button
                onClick={() => navigate(`/owner/daily-settlement/${stations[0].id}`)}
                variant="outline"
                size="sm"
                className="px-3 py-1.5 text-xs font-medium border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 transition-all duration-200 touch-manipulation"
              >
                Daily Settlement
              </Button>
              <Button
                onClick={() => navigate(`/owner/stations/${stations[0].id}`)}
                variant="outline"
                size="sm"
                className="px-3 py-1.5 text-xs font-medium border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 touch-manipulation"
              >
                Manage Station
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <StationsList stations={stations} isLoading={isLoading} navigate={navigate} />
    </Card>
  );
}
