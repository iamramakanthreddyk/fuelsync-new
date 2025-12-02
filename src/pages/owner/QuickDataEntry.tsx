/**
 * Quick Data Entry for Owners
 * Fast nozzle reading entry across all stations
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { FuelBadge } from '@/components/FuelBadge';
import {
  Zap,
  Building2,
  Fuel,
  Check,
  X,
  Calendar,
  TrendingUp
} from 'lucide-react';

interface Station {
  id: string;
  name: string;
  code: string;
}

interface Pump {
  id: string;
  pumpNumber: number;
  name: string;
  status: string;
  nozzles: Nozzle[];
}

interface Nozzle {
  id: string;
  nozzleNumber: number;
  fuelType: string;
  status: string;
  initialReading: number;
  lastReading?: number;
}


interface ReadingEntry {
  nozzleId: string;
  readingValue: string;
  date: string;
  paymentType: string;
}

export default function QuickDataEntry() {

  const [selectedStation, setSelectedStation] = useState<string>('');
  const [readings, setReadings] = useState<Record<string, ReadingEntry>>({});
  const [readingDate, setReadingDate] = useState(new Date().toISOString().split('T')[0]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch stations
  const { data: stations } = useQuery({
    queryKey: ['owner-stations'],
    queryFn: async () => {
      const response = await apiClient.get<Station[]>('/stations');
      return response;
    }
  });

  // Fetch pumps for selected station
  const { data: pumps, isLoading: pumpsLoading } = useQuery({
    queryKey: ['station-pumps', selectedStation],
    queryFn: async () => {
      if (!selectedStation) return [];
      const response = await apiClient.get<Pump[]>(`/stations/${selectedStation}/pumps`);
      return response;
    },
    enabled: !!selectedStation
  });

  // Log last reading for all nozzles when pumps data changes
  useEffect(() => {
    if (pumps && pumps.length > 0) {
      pumps.forEach(pump => {
        pump.nozzles.forEach(nozzle => {
          const lastReading = nozzle.lastReading ? parseFloat(String(nozzle.lastReading)) : null;
          const initialReading = nozzle.initialReading ? parseFloat(String(nozzle.initialReading)) : null;
          
          const last =
            lastReading !== null && !isNaN(lastReading)
              ? lastReading
              : (initialReading !== null && !isNaN(initialReading)
                ? initialReading
                : Number(nozzle.lastReading) || Number(nozzle.initialReading) || 0);
          console.log(`Pump ${pump.name || pump.pumpNumber}, Nozzle ${nozzle.nozzleNumber}: Last Reading =`, last);
        });
      });
    }
  }, [pumps]);
  // ...existing code...

  // Submit readings mutation
  const submitReadingsMutation = useMutation({
    mutationFn: async (data: ReadingEntry[]) => {
      const promises = data.map(entry =>
        apiClient.post('/readings', {
          nozzleId: entry.nozzleId,
          readingValue: parseFloat(entry.readingValue),
          readingDate: entry.date,
          paymentType: entry.paymentType
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'All readings saved successfully'
      });
      // Clear the form
      setReadings({});
      // Invalidate higher-level queries that depend on readings
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['station-pumps', selectedStation] });
    },
    onError: (error: unknown) => {
      let message = 'Failed to save readings';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error && 'message' in error) {
        message = String((error as { message?: string }).message);
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  const handleReadingChange = (nozzleId: string, value: string) => {
    setReadings(prev => ({
      ...prev,
      [nozzleId]: {
        nozzleId,
        readingValue: value,
        date: readingDate,
        paymentType: 'cash'
      }
    }));
  };

  const handleSubmit = () => {
    const entries = Object.values(readings).filter(r => r.readingValue && parseFloat(r.readingValue) > 0);
    if (entries.length === 0) {
      toast({
        title: 'No readings entered',
        description: 'Please enter at least one reading',
        variant: 'destructive'
      });
      return;
    }
    submitReadingsMutation.mutate(entries);
  };

  const pendingCount = Object.keys(readings).length;
  const totalNozzles = pumps?.reduce((sum, pump) => sum + pump.nozzles.length, 0) || 0;

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
            Quick Entry
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Fast nozzle reading entry
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge className="text-sm px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600">
            {pendingCount} Pending
          </Badge>
        )}
      </div>

      {/* Station & Date Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Select Station & Date</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="station" className="text-xs sm:text-sm">Station</Label>
              <Select value={selectedStation} onValueChange={setSelectedStation}>
                <SelectTrigger id="station">
                  <SelectValue placeholder="Choose a station" />
                </SelectTrigger>
                <SelectContent>
                  {stations?.map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {station.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="date" className="text-xs sm:text-sm">Reading Date</Label>
              <Input
                id="date"
                type="date"
                value={readingDate}
                onChange={(e) => setReadingDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Readings Entry */}
      {selectedStation && pumpsLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-sm text-muted-foreground">
              Loading pumps...
            </div>
          </CardContent>
        </Card>
      ) : selectedStation && pumps && pumps.length > 0 ? (
        <>
          <div className="space-y-4">
            {pumps.map((pump) => (
              <Card key={pump.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Fuel className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {pump.name || `Pump ${pump.pumpNumber}`}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {pump.nozzles.length} nozzles
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={pump.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {pump.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pump.nozzles.map((nozzle) => (
                      <div
                        key={nozzle.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <span className="font-semibold text-sm">N{nozzle.nozzleNumber}</span>
                          <FuelBadge fuelType={nozzle.fuelType} showDot />
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-2 sm:gap-3">
                          <div className="bg-background p-2 rounded border">
                            <div className="text-xs text-muted-foreground mb-0.5">Meter Reading</div>
                            <div className="font-mono text-sm font-semibold">
                              {(() => {
                                const lastReading = nozzle.lastReading ? parseFloat(String(nozzle.lastReading)) : null;
                                const initialReading = nozzle.initialReading ? parseFloat(String(nozzle.initialReading)) : null;
                                
                                if (lastReading !== null && !isNaN(lastReading)) {
                                  return lastReading.toFixed(2);
                                } else if (initialReading !== null && !isNaN(initialReading)) {
                                  return initialReading.toFixed(2);
                                } else {
                                  return '0.00';
                                }
                              })()}
                            </div>
                          </div>

                          <div className="relative">
                            <Input
                              type="number"
                              step="any"
                              placeholder="Meter reading"
                              title="Enter the current meter reading from the pump display"
                              value={readings[nozzle.id]?.readingValue || ''}
                              onChange={(e) => handleReadingChange(nozzle.id, e.target.value)}
                              className="pr-8"
                              disabled={nozzle.status !== 'active'}
                            />
                            {readings[nozzle.id]?.readingValue && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                {(() => {
                                  const enteredValue = parseFloat(readings[nozzle.id].readingValue);
                                  const lastReading = nozzle.lastReading ? parseFloat(String(nozzle.lastReading)) : null;
                                  const initialReading = nozzle.initialReading ? parseFloat(String(nozzle.initialReading)) : null;
                                  const compareValue = lastReading !== null && !isNaN(lastReading) ? lastReading : (initialReading !== null && !isNaN(initialReading) ? initialReading : 0);
                                  
                                  return enteredValue > compareValue ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <X className="w-4 h-4 text-red-500" />
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Submit Button */}
          <Card className="sticky bottom-4 shadow-lg border-2">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm">
                  <div className="font-semibold">{pendingCount} of {totalNozzles} readings entered</div>
                  <div className="text-xs text-muted-foreground">
                    for {new Date(readingDate).toLocaleDateString('en-IN', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </div>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={pendingCount === 0 || submitReadingsMutation.isPending}
                  size="lg"
                  className="min-w-[120px]"
                >
                  {submitReadingsMutation.isPending ? (
                    'Saving...'
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Submit All
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : selectedStation ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Fuel className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">No Pumps Found</h3>
                <p className="text-sm text-muted-foreground">
                  This station doesn't have any pumps configured yet
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Building2 className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Select a Station</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a station above to start entering readings
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
