import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useStations } from '@/hooks/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProfitDashboard } from '@/components/dashboard/ProfitDashboard';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

const ProfitReports = () => {
  const { user } = useAuth();
  const { data: stationsResponse } = useStations();
  const stations = stationsResponse?.data;
  const [selectedStationId, setSelectedStationId] = React.useState<string>('');
  const [currentMonth, setCurrentMonth] = React.useState<string>(
    new Date().toISOString().slice(0, 7)
  );

  // Set default station on load
  React.useEffect(() => {
    if (stations && stations.length > 0 && !selectedStationId) {
      setSelectedStationId(stations[0].id);
    }
  }, [stations, selectedStationId]);

  // Export profitable data
  const handleExportCSV = async () => {
    try {
      const response = await apiClient.get(
        `/stations/${selectedStationId}/profit-export?month=${currentMonth}&format=csv`,
        {
          responseType: 'blob'
        }
      );
      
      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `profit-${selectedStationId}-${currentMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data');
    }
  };

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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with Export */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Profit Reports</h1>
          <p className="text-muted-foreground mt-2">
            Track your station's revenue, costs, and profitability over time
          </p>
        </div>
        {selectedStationId && (
          <Button 
            onClick={handleExportCSV}
            className="gap-2"
            variant="outline"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Station Selector */}
      {stations && stations.length > 1 && (
        <Card>
          <CardContent className="pt-6">
            <label className="text-sm font-medium">Select Station:</label>
            <Select value={selectedStationId} onValueChange={setSelectedStationId}>
              <SelectTrigger className="w-full max-w-xs mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stations.map((station) => (
                  <SelectItem key={station.id} value={station.id}>
                    {station.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Profit Dashboard */}
      {selectedStationId && currentStation && (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold">{currentStation.name}</h2>
              <p className="text-muted-foreground text-sm mt-1">
                {currentStation.address}
              </p>
            </div>
          </div>

          <ProfitDashboard stationId={selectedStationId} />
        </>
      )}

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About Profit Reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm mb-1">Revenue</h4>
            <p className="text-sm text-muted-foreground">
              Total income from fuel sales for the selected period
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-1">Cost of Goods Sold (COGS)</h4>
            <p className="text-sm text-muted-foreground">
              The purchase price of fuel you sold. Make sure to set purchase prices for all fuel types to calculate COGS accurately.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-1">Operating Expenses</h4>
            <p className="text-sm text-muted-foreground">
              Staff salaries, rent, repairs, utilities, and other operational costs tracked in the Expenses section.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-1">Net Profit</h4>
            <p className="text-sm text-muted-foreground">
              Revenue - COGS - Operating Expenses. This is your actual profit after all costs.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitReports;
