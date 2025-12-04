/**
 * Settlement Station Selector
 * Allows manager/owner to select a station for daily settlement
 */

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { useStations } from '@/hooks/api';
import {
  Scale3d,
  Building2,
  ArrowRight,
  Calendar
} from 'lucide-react';

export default function SettlementStationSelector() {
  const navigate = useNavigate();
  const { data: stationsResponse } = useStations();
  const stations = stationsResponse?.data || [];

  // Fetch today's summary for each station
  const { data: summaries = [] } = useQuery({
    queryKey: ['settlement-summaries'],
    queryFn: async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await apiClient.get(`/reports/daily-sales?date=${today}`);
        
        if (response && typeof response === 'object' && 'data' in response) {
          return Array.isArray(response.data) ? response.data : [];
        }
        return [];
      } catch (error) {
        console.error('Failed to fetch summaries:', error);
        return [];
      }
    }
  });

  const getSummaryForStation = (stationId: string) => {
    return summaries.find((s: any) => s.stationId === stationId);
  };

  const handleSelectStation = (stationId: string) => {
    navigate(`/owner/daily-settlement/${stationId}`);
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
          <Scale3d className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Daily Settlement</h1>
          <p className="text-sm text-muted-foreground">
            Select a station to finalize today's sales and reconcile cash
          </p>
        </div>
      </div>

      {/* Today's Date */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-sm text-muted-foreground">Settlement Date</p>
            <p className="text-lg font-semibold text-blue-900">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stations Grid */}
      {stations && stations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map((station) => {
            const summary = getSummaryForStation(station.id);
            const hasReadings = summary && summary.totalSaleValue > 0;

            return (
              <Card
                key={station.id}
                className={`hover:shadow-lg transition-all cursor-pointer ${
                  hasReadings ? 'border-green-200 bg-green-50' : 'border-gray-200'
                }`}
                onClick={() => handleSelectStation(station.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">{station.name}</CardTitle>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {hasReadings ? (
                    <>
                      <div className="space-y-2 p-2.5 bg-white rounded border border-green-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Sale Value</span>
                          <span className="font-bold text-green-600">
                            ₹{summary.totalSaleValue.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Readings</span>
                          <span className="font-semibold text-gray-700">
                            {summary.readingsCount || 0}
                          </span>
                        </div>
                        {summary.settlementStatus && (
                          <div className="flex items-center justify-between pt-1 border-t">
                            <span className="text-xs text-muted-foreground">Status</span>
                            <Badge
                              variant="outline"
                              className={
                                summary.settlementStatus === 'settled'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }
                            >
                              {summary.settlementStatus}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={() => handleSelectStation(station.id)}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        Start Settlement
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground text-center py-2">
                        No readings for today
                      </p>
                      <Button
                        onClick={() => handleSelectStation(station.id)}
                        variant="outline"
                        className="w-full"
                      >
                        View Settlement
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Building2 className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">No Stations Available</h3>
                <p className="text-sm text-muted-foreground">
                  Add stations to start performing settlements
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
