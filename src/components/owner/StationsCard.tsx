/**
 * StationsCard - Stations list with header
 * Displays the full stations card with header, count badge, and station items
 */

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, ArrowRight } from 'lucide-react';
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
    <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-primary">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <CardTitle className="text-base sm:text-lg">Your Stations</CardTitle>
              {Array.isArray(stations) && stations.length > 0 && (
                <Badge variant="secondary">{stations.length}</Badge>
              )}
            </div>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Performance overview
            </CardDescription>
          </div>
          <Button 
            onClick={() => navigate('/owner/stations')} 
            size="sm" 
            className="flex-shrink-0"
            variant="outline"
          >
            <span className="hidden sm:inline">View All</span>
            <span className="sm:hidden">All</span>
            <ArrowRight className="w-4 h-4 ml-1 sm:ml-2" />
          </Button>
        </div>
      </CardHeader>
      <StationsList stations={stations} isLoading={isLoading} navigate={navigate} />
    </Card>
  );
}
