/**
 * FilterBar Component
 * A reusable filter bar for date range and station selection
 */

import React from 'react';
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
  return (
    <Card className={`border-0 shadow-lg bg-white/80 backdrop-blur-sm ${className}`}>
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Filter className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Filters</h3>
              <p className="text-sm text-gray-500">Customize your view</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) =>
                    onDateRangeChange({ ...dateRange, startDate: e.target.value })
                  }
                  className="w-full"
                />
                <Input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) =>
                    onDateRangeChange({ ...dateRange, endDate: e.target.value })
                  }
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Station</Label>
              <Select value={selectedStation} onValueChange={onStationChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
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
      </CardContent>
    </Card>
  );
};

export default FilterBar;
