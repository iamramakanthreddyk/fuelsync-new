import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useStations } from '@/hooks/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, BarChart3 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DateRangeFilterToolbar } from '@/components/DateRangeFilterToolbar';
import { useGlobalFilter } from '@/context/GlobalFilterContext';
import { ProfitDashboardWithProvider } from '@/components/dashboard/ProfitDashboardWithProvider';

const ProfitReports = () => {
  const { user } = useAuth();
  const { data: stationsResponse } = useStations();
  const stations = stationsResponse?.data;
  const { startDate, endDate } = useGlobalFilter();
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <DateRangeFilterToolbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Enhanced Header with Icon */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg shadow-sm">
                <BarChart3 className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Profit Reports</h1>
              </div>
            </div>
            <p className="text-muted-foreground text-sm ml-11">
              Financial performance from {startDate} to {endDate}
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
        <ProfitDashboardWithProvider stationId={selectedStationId} dateRange={{ startDate, endDate }} />
      )}
      </div>
    </div>
  );
};

export default ProfitReports;
