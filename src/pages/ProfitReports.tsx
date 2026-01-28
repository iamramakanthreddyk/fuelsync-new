import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useStations } from '@/hooks/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProfitDashboard } from '@/components/dashboard/ProfitDashboard';

const ProfitReports = () => {
  const { user } = useAuth();
  const { data: stationsResponse } = useStations();
  const stations = stationsResponse?.data;
  const [selectedStationId, setSelectedStationId] = React.useState<string>('');

  // Set default station on load
  React.useEffect(() => {
    if (stations && stations.length > 0 && !selectedStationId) {
      setSelectedStationId(stations[0].id);
    }
  }, [stations, selectedStationId]);

  // Check if user is owner
  if (!user || user.role !== 'owner') {
    return (
      <div className="container mx-auto p-6 mt-20">
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Only station owners can view profit reports. Your current role: <strong>{user?.role || 'unknown'}</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStation = stations?.find(s => s.id === selectedStationId);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Profit Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your station's financial performance at a glance
          </p>
        </div>

        {/* Station Selector - Compact */}
        {stations && stations.length > 1 && (
          <div className="w-full sm:w-auto">
            <Select value={selectedStationId} onValueChange={setSelectedStationId}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select station" />
              </SelectTrigger>
              <SelectContent>
                {stations.map((station) => (
                  <SelectItem key={station.id} value={station.id}>
                    {station.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Station Profit Dashboard */}
      {selectedStationId && currentStation && (
        <ProfitDashboard stationId={selectedStationId} />
      )}
    </div>
  );
};

export default ProfitReports;
