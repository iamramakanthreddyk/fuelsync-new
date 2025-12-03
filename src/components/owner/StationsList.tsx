import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Activity, Clock, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
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
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading stations...</p>
        </div>
      </CardContent>
    );
  }

  if (!Array.isArray(stations) || stations.length === 0) {
    return (
      <CardContent>
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">No stations yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by adding your first fuel station
            </p>
            <Button onClick={() => navigate('/owner/stations')} size="sm">
              <Building2 className="w-4 h-4 mr-2" />
              Add Your First Station
            </Button>
          </div>
        </div>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <div className="space-y-3">
        {stations.map((station, idx) => {
          const pumpUtilization = (station.pumpCount || 0) > 0 
            ? ((station.activePumps || 0) / (station.pumpCount || 0)) * 100 
            : 0;
          return (
            <div
              key={station.id}
              className="group flex items-start sm:items-center justify-between p-3 sm:p-4 border-2 rounded-xl hover:border-primary/50 hover:shadow-md cursor-pointer transition-all duration-300 bg-gradient-to-r hover:from-primary/5 hover:to-transparent"
              onClick={() => navigate(`/owner/stations/${station.id}`)}
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                <div className="relative">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  {idx === 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">★</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm sm:text-base truncate">
                      {station.name}
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {station.code || 'N/A'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Activity className="w-3 h-3" />
                      <span>
                        {(station.activePumps || 0)}/{(station.pumpCount || 0)} pumps
                      </span>
                    </div>
                    {station.lastReading && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>Last: {new Date(station.lastReading).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="w-full max-w-[200px]">
                    <Progress 
                      value={pumpUtilization} 
                      className="h-1.5"
                    />
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <div className="space-y-1">
                  <p className="font-bold text-base sm:text-lg bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    {formatCurrency(station.todaySales || 0)}
                  </p>
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Today</span>
                    <span className="sm:hidden">TD</span>
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </CardContent>
  );
}
