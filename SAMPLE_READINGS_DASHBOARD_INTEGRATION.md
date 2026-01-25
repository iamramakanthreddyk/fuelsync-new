# Sample Readings Dashboard Integration Guide

**For:** Adding Sample Readings Report to Owner Dashboard  
**Created:** January 25, 2026

---

## Overview

The Sample Readings Report endpoint is ready (`/api/v1/reports/sample-readings`).  
This guide shows how to add a dashboard widget for owners to view sample readings.

---

## 1. Create Hook for Sample Readings

**File to create:** `src/hooks/useSampleReadingsReport.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface SampleReadingDetail {
  id: string;
  readingDate: string;
  readingValue: number;
  litresSold: number;
  nozzleNumber: string;
  fuelType: string;
  pumpName: string;
  enteredBy: string;
  enteredAt: string;
  notes?: string;
}

interface SampleReadingByDate {
  date: string;
  totalSamples: number;
  byNozzle: Record<string, number>;
  readings: SampleReadingDetail[];
}

interface SampleReadingsReport {
  summary: {
    dateRange: { startDate: string; endDate: string };
    totalSampleReadings: number;
    stationsIncluded: Array<{ id: string; name: string; code: string }>;
  };
  details: SampleReadingByDate[];
}

export const useSampleReadingsReport = (
  startDate?: string,
  endDate?: string,
  stationId?: string
) => {
  return useQuery<SampleReadingsReport>({
    queryKey: ['sample-readings-report', startDate, endDate, stationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (stationId) params.append('stationId', stationId);

      const response = await apiClient.get<SampleReadingsReport>(
        `/api/v1/reports/sample-readings?${params.toString()}`
      );
      return response;
    },
    enabled: !!(startDate && endDate),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

---

## 2. Create Dashboard Component

**File to create:** `src/components/dashboard/SampleReadingsDashboard.tsx`

```typescript
import React, { useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSampleReadingsReport } from '@/hooks/useSampleReadingsReport';
import { CheckCircle2, Droplets } from 'lucide-react';

interface SampleReadingsDashboardProps {
  stationId?: string;
  daysBack?: number;
}

export function SampleReadingsDashboard({
  stationId,
  daysBack = 7
}: SampleReadingsDashboardProps) {
  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(subDays(new Date(), daysBack), 'yyyy-MM-dd');

  const { data: report, isLoading, error } = useSampleReadingsReport(
    startDate,
    endDate,
    stationId
  );

  const totalSamples = report?.summary.totalSampleReadings ?? 0;
  const avgPerDay = useMemo(() => {
    if (!report?.details.length) return 0;
    return (totalSamples / report.details.length).toFixed(1);
  }, [totalSamples, report?.details]);

  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            Sample Readings
          </CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Sample Readings</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-600">
          Failed to load sample readings
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-500" />
          Quality Checks (Sample Readings)
        </CardTitle>
        <CardDescription>
          {daysBack} days from {startDate} to {endDate}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalSamples === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Droplets className="w-12 h-12 mx-auto opacity-20 mb-4" />
            <p>No sample readings in this period</p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Samples</p>
                <p className="text-2xl font-bold text-blue-600">{totalSamples}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Avg per Day</p>
                <p className="text-2xl font-bold text-green-600">{avgPerDay}</p>
              </div>
            </div>

            {/* Details by Date */}
            {report?.details && report.details.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-3">By Date</h4>
                <div className="space-y-3">
                  {report.details.map((dayData) => (
                    <div key={dayData.date} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">
                          {format(new Date(dayData.date), 'MMM dd, yyyy')}
                        </span>
                        <Badge variant="secondary">
                          {dayData.totalSamples} sample{dayData.totalSamples !== 1 ? 's' : ''}
                        </Badge>
                      </div>

                      {/* Nozzle Breakdown */}
                      <div className="text-sm text-muted-foreground space-y-1 mt-2">
                        {Object.entries(dayData.byNozzle).map(([nozzle, count]) => (
                          <div key={nozzle} className="flex justify-between pl-2">
                            <span>{nozzle}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## 3. Add to Owner Dashboard

**File:** `src/pages/owner/Dashboard.tsx` (or similar)

```typescript
import { SampleReadingsDashboard } from '@/components/dashboard/SampleReadingsDashboard';

export default function OwnerDashboard() {
  const { userStation } = useRoleAccess();

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Other dashboard cards */}
      
      {/* NEW: Sample Readings */}
      <SampleReadingsDashboard stationId={userStation?.id} daysBack={7} />
    </div>
  );
}
```

---

## 4. Alternative: Detailed Report Page

**File to create:** `src/pages/owner/SampleReadingsReport.tsx`

```typescript
import React, { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSampleReadingsReport } from '@/hooks/useSampleReadingsReport';
import { CheckCircle2, Download } from 'lucide-react';

export default function SampleReadingsReport() {
  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 30), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: report, isLoading } = useSampleReadingsReport(startDate, endDate);

  const handleExport = () => {
    if (!report) return;

    const csv = [
      ['Sample Readings Report'],
      ['Period', `${startDate} to ${endDate}`],
      ['Total Samples', report.summary.totalSampleReadings],
      [],
      ['Date', 'Nozzle', 'Pump', 'Fuel Type', 'Litres', 'Entered By', 'Time']
    ];

    report.details.forEach((day) => {
      day.readings.forEach((reading) => {
        csv.push([
          reading.readingDate,
          reading.nozzleNumber,
          reading.pumpName,
          reading.fuelType,
          reading.litresSold.toString(),
          reading.enteredBy,
          format(new Date(reading.enteredAt), 'HH:mm:ss')
        ]);
      });
    });

    const csvText = csv.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvText], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample-readings-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CheckCircle2 className="w-8 h-8 text-blue-500" />
          Sample Readings Report
        </h1>
        <p className="text-muted-foreground mt-2">
          Track quality checks and fuel test readings
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleExport}
                disabled={isLoading || !report}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Data */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">Loading...</CardContent>
        </Card>
      ) : report ? (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              {report.summary.totalSampleReadings} samples found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.details.length === 0 ? (
              <p className="text-muted-foreground">No samples in this period</p>
            ) : (
              <div className="space-y-4">
                {report.details.map((dayData) => (
                  <div key={dayData.date} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">
                      {format(new Date(dayData.date), 'EEEE, MMMM dd, yyyy')}
                    </h3>
                    <div className="space-y-2">
                      {dayData.readings.map((reading) => (
                        <div key={reading.id} className="text-sm border-l-2 border-blue-300 pl-3">
                          <div className="flex justify-between">
                            <strong>
                              {reading.pumpName} - Nozzle {reading.nozzleNumber} ({reading.fuelType})
                            </strong>
                            <span className="text-muted-foreground">
                              {format(new Date(reading.enteredAt), 'HH:mm:ss')}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {reading.litresSold}L • Entered by {reading.enteredBy}
                            {reading.notes && ` • Notes: ${reading.notes}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
```

---

## 5. Update Navigation

Add to owner's sidebar/navigation:
```typescript
{
  label: 'Sample Readings',
  href: '/owner/sample-readings-report',
  icon: <CheckCircle2 className="w-4 h-4" />
}
```

---

## 6. Integration Points

### Dashboard Summary Card
- Show total samples taken this week
- Quick at-a-glance metric

### Detailed Report Page
- Full report with filtering
- Export to CSV
- Grouped by date

### Mobile-Friendly Widget
- Compact view for mobile dashboard
- Tap to expand details

---

## Testing Checklist

- [ ] Hook fetches data correctly
- [ ] Dashboard widget displays
- [ ] Summary stats calculate properly
- [ ] Details group by date
- [ ] Report page filters work
- [ ] CSV export generates correctly
- [ ] Mobile layout responsive
- [ ] No errors in console

---

## Dependencies

Required for frontend components:
- `@tanstack/react-query` - Already installed
- `date-fns` - Already installed
- `lucide-react` - Already installed
- UI components (Card, Badge, etc.) - Already available

---

**Status:** Ready for Frontend Implementation
