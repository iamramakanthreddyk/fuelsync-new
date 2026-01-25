import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useStations } from '@/hooks/api';
import { apiClient } from '@/lib/api-client';
import { getFuelBadgeClasses } from '@/lib/fuelColors';
import { BarChart3, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';

interface SampleReading {
  id: string;
  date: string;
  nozzleNumber: number;
  fuelType: string;
  enteredBy: string;
  readingValue: number;
  litresSold: number;
  pumpName: string;
  enteredAt: string;
  notes?: string;
}

interface SampleReadingGroup {
  date: string;
  totalSamples: number;
  readings: SampleReading[];
}

interface SampleStatistics {
  dailyTrend: Array<{
    date: string;
    sampleCount: number;
    totalLitres: number;
    totalValue: number;
  }>;
  byNozzle: Array<{
    nozzleNumber: string;
    sampleCount: number;
    lastSampleDate: string;
  }>;
  byEmployee: Array<{
    employeeName: string;
    sampleCount: number;
    lastSampleDate: string;
  }>;
  coverage: number;
}

export default function SampleReadings() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [data, setData] = useState<SampleReadingGroup[] | SampleStatistics>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const { data: stationsResponse } = useStations();
  const stations = stationsResponse?.data;

  // Set default station
  useEffect(() => {
    if (stations && stations.length > 0 && !selectedStation) {
      setSelectedStation(stations[0].id);
    }
  }, [stations, selectedStation]);

  const fetchSampleReadings = async () => {
    if (!startDate || !endDate) {
      toast({ title: 'Error', description: 'Please select date range' });
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(selectedStation && { stationId: selectedStation })
      });

      const result = await apiClient.get(`/reports/sample-readings?${params}`);
      // Extract the details array from the response
      const details = (result as any)?.details || [];
      setData(details);

      if (!details || details.length === 0) {
        toast({ title: 'Info', description: 'No sample readings found for this period' });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch data'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSampleStatistics = async () => {
    if (!startDate || !endDate) {
      toast({ title: 'Error', description: 'Please select date range' });
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(selectedStation && { stationId: selectedStation })
      });

      const result = await apiClient.get(`/reports/sample-statistics?${params}`);
      const statsData = result || {};
      const emptyStats: SampleStatistics = {
        dailyTrend: [],
        byNozzle: [],
        byEmployee: [],
        coverage: 0
      };
      
      // Check if result has the proper structure with proper type guards
      const hasDailyStats = Array.isArray((statsData as any).dailyStats) && (statsData as any).dailyStats.length > 0;
      const hasNozzleFreq = Array.isArray((statsData as any).nozzleFrequency);
      const hasUserFreq = Array.isArray((statsData as any).userFrequency);
      const hasSummary = (statsData as any).summary && typeof (statsData as any).summary === 'object';
      
      if (hasDailyStats || hasNozzleFreq || hasUserFreq || hasSummary) {
        // Map API response to component interface
        const coverageStr = (statsData as any).summary?.testingCoverage || '0%';
        const coverageNum = parseFloat(String(coverageStr).replace('%', ''));
        
        const mappedStats: SampleStatistics = {
          dailyTrend: ((statsData as any).dailyStats || []).map((d: any) => ({
            date: d.date,
            sampleCount: d.sampleCount,
            totalLitres: d.totalLitres,
            totalValue: d.totalValue
          })),
          byNozzle: ((statsData as any).nozzleFrequency || []).map((n: any) => ({
            nozzleNumber: `${n.pumpName || n.pumpNumber} - Nozzle ${n.nozzleNumber}`,
            sampleCount: n.sampleCount,
            lastSampleDate: n.lastSampleDate
          })),
          byEmployee: ((statsData as any).userFrequency || []).map((u: any) => ({
            employeeName: u.userName,
            sampleCount: u.sampleCount,
            lastSampleDate: u.lastSampleDate
          })),
          coverage: coverageNum
        };
        setData(mappedStats);
      } else {
        setData(emptyStats);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch data'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Sample Readings</h1>
        </div>
        <p className="text-muted-foreground">
          Monitor quality check readings and testing patterns across your stations
        </p>
      </div>

      {/* Filters */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Filter & Search</CardTitle>
          <CardDescription>Select your date range and station to view sample data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="station">Station</Label>
                <Select value={selectedStation || 'all'} onValueChange={(value) => setSelectedStation(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a station" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stations</SelectItem>
                    {(Array.isArray(stations) ? stations : []).map((station) => (
                      <SelectItem key={station.id} value={station.id}>
                        {station.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={fetchSampleReadings} className="w-full">
                View Readings
              </Button>
              <Button onClick={fetchSampleStatistics} variant="outline" className="w-full">
                View Statistics
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Sample Readings & Statistics</CardTitle>
          <CardDescription>
            Detailed list of all quality check readings and testing patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
              <p>Loading your sample readings...</p>
            </div>
          ) : !data || (Array.isArray(data) && data.length === 0) ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground mb-1">No sample readings found</p>
              <p className="text-sm text-muted-foreground">Try selecting a different date range or station</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Sample Readings Details */}
              {Array.isArray(data) && data.map((group, idx) => (
                <div key={idx} className="border rounded-lg p-4 bg-gradient-to-br from-muted/30 to-muted/10 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-lg">
                      {group.date} — <span className="text-primary">{group.totalSamples} samples</span>
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-3 text-left font-semibold">Nozzle</th>
                          <th className="p-3 text-left font-semibold">Type</th>
                          <th className="p-3 text-right font-semibold">Reading</th>
                          <th className="p-3 text-right font-semibold">Litres</th>
                          <th className="p-3 text-left font-semibold">Pump</th>
                          <th className="p-3 text-left font-semibold">Entered By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.readings.map((reading, ridx) => (
                          <tr key={ridx} className="border-t hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-medium">{reading.nozzleNumber}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium border ${getFuelBadgeClasses(reading.fuelType)}`}>
                                {reading.fuelType}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono text-sm">{reading.readingValue.toLocaleString()}</td>
                            <td className="p-3 text-right font-medium">{reading.litresSold}L</td>
                            <td className="p-3 text-sm">{reading.pumpName}</td>
                            <td className="p-3 text-sm text-muted-foreground">{reading.enteredBy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Statistics View */}
              {!Array.isArray(data) && (
                <div className="space-y-4">
                  {/* Daily Trend */}
                  {(data as SampleStatistics).dailyTrend && (
                    <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50/50 to-transparent hover:shadow-sm transition-shadow">
                      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        Daily Trend
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-2 text-left">Date</th>
                              <th className="p-2 text-left">Samples</th>
                              <th className="p-2 text-left">Litres</th>
                              <th className="p-2 text-left">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(data as SampleStatistics).dailyTrend.map((day: any, idx: number) => (
                              <tr key={idx} className="border-t hover:bg-muted/50">
                                <td className="p-2">{day.date}</td>
                                <td className="p-2">{day.sampleCount}</td>
                                <td className="p-2">{day.totalLitres} L</td>
                                <td className="p-2">₹{day.totalValue}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* By Nozzle */}
                  {(data as SampleStatistics).byNozzle && (
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold text-lg mb-3">Testing by Nozzle</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-2 text-left">Nozzle</th>
                              <th className="p-2 text-left">Samples</th>
                              <th className="p-2 text-left">Last Test</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(data as SampleStatistics).byNozzle.map((nozzle: any, idx: number) => (
                              <tr key={idx} className="border-t hover:bg-muted/50">
                                <td className="p-2 font-medium">{nozzle.nozzleNumber}</td>
                                <td className="p-2">{nozzle.sampleCount}</td>
                                <td className="p-2">{nozzle.lastSampleDate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* By Employee */}
                  {(data as SampleStatistics).byEmployee && (
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold text-lg mb-3">Testing by Employee</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-2 text-left">Employee</th>
                              <th className="p-2 text-left">Samples</th>
                              <th className="p-2 text-left">Last Activity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(data as SampleStatistics).byEmployee.map((emp: any, idx: number) => (
                              <tr key={idx} className="border-t hover:bg-muted/50">
                                <td className="p-2 font-medium">{emp.employeeName}</td>
                                <td className="p-2">{emp.sampleCount}</td>
                                <td className="p-2">{emp.lastSampleDate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Coverage */}
                  {(data as SampleStatistics).coverage && (
                    <div className="border rounded-lg p-4 bg-green-50">
                      <p className="text-sm text-muted-foreground">Testing Coverage</p>
                      <p className="text-2xl font-bold text-green-600">{(data as SampleStatistics).coverage}%</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
