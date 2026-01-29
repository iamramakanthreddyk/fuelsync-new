/**
 * FilterBar Component
 * A reusable filter bar for date range and station selection
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import { Filter, RefreshCw, Download } from 'lucide-react';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface StationOption {
  id: string;
  name: string;
}

export interface FilterBarProps {
  /** Current date range */
  dateRange: DateRange;
  /** Date range change handler */
  onDateRangeChange: (range: DateRange) => void;
  /** Selected station ID */
  selectedStation: string;
  /** Station change handler */
  onStationChange: (stationId: string) => void;
  /** Available stations */
  stations: StationOption[];
  /** Refresh handler */
  onRefresh?: () => void;
  /** Export all handler */
  onExportAll?: () => void;
  /** Show refresh button */
  showRefresh?: boolean;
  /** Show export button */
  showExport?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  dateRange,
  onDateRangeChange,
  selectedStation,
  onStationChange,
  stations,
  onRefresh,
  onExportAll,
  showRefresh = true,
  showExport = true,
  className,
}) => {
  const [open, setOpen] = useState<boolean>(true);

  useEffect(() => {
    // On small screens, collapse filters by default for space
    try {
      const isSmall = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
      setOpen(!isSmall);
    } catch (e) {
      // ignore
    }
  }, []);
  return (
    <Card className={`border bg-white shadow-sm ${className}`}>
      <CardContent className="p-3 md:p-4">
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Filter className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Filters</h3>
                <p className="text-sm text-gray-500">Customize your view</p>
              </div>
            </div>
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="report-filters"
              >
                {open ? 'Hide' : 'Show'} filters
              </Button>
            </div>
          </div>

          <div id="report-filters" className={`${open ? 'block' : 'hidden'} md:block`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Date Range</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) =>
                      onDateRangeChange({ ...dateRange, startDate: e.target.value })
                    }
                    className="w-full py-3"
                  />
                  <Input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) =>
                      onDateRangeChange({ ...dateRange, endDate: e.target.value })
                    }
                    className="w-full py-3"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Station</Label>
                <Select value={selectedStation} onValueChange={onStationChange}>
                  <SelectTrigger className="w-full py-2 md:py-1">
                    <SelectValue aria-label="Select station" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stations</SelectItem>
                    {stations.map((station) => (
                      <SelectItem key={station.id} value={station.id}>
                        {station.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 md:justify-end md:items-end">
                {showRefresh && onRefresh && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={onRefresh}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                )}
                {showExport && onExportAll && (
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={onExportAll}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export All
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FilterBar;
