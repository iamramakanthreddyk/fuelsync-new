import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';
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

interface StationsListProps {
  stations: Station[];
  isLoading: boolean;
  navigate: NavigateFunction;
}

export function StationsList({ stations, isLoading, navigate }: StationsListProps) {
  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  if (isLoading) {
    return (
      <CardContent className="pt-0">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      </CardContent>
    );
  }

  if (!Array.isArray(stations) || stations.length === 0) {
    return (
      <CardContent className="pt-0">
        <div className="text-center py-8 space-y-3">
          <Building2 className="w-8 h-8 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-medium text-sm mb-1">No stations yet</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Add your first fuel station to get started
            </p>
            <Button onClick={() => navigate('/owner/stations')} size="sm" className="text-xs">
              Add Station
            </Button>
          </div>
        </div>
      </CardContent>
    );
  }

  return (
    <CardContent className="pt-0">
      <div className="space-y-2">
        {stations.map((station, idx) => {
          const pumpUtilization = (station.pumpCount || 0) > 0
            ? ((station.activePumps || 0) / (station.pumpCount || 0)) * 100
            : 0;
          return (
            <div
              key={station.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all duration-200"
              onClick={() => navigate(`/owner/stations/${station.id}`)}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  {idx === 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">★</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm truncate">
                      {station.name}
                    </h3>
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {station.code || 'N/A'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>{(station.activePumps || 0)}/{(station.pumpCount || 0)} pumps</span>
                    <span>{Math.round(pumpUtilization)}% active</span>
                    {station.lastReading && (
                      <span>{station.lastReading}L</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-sm text-green-600">
                  {formatCurrency(station.todaySales || 0)}
                </div>
                <div className="text-xs text-muted-foreground">today</div>
              </div>
            </div>
          );
        })}
      </div>
    </CardContent>
  );
}
