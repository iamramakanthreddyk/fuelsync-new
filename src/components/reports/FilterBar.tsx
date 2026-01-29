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
import { Badge } from '@/components/ui/badge';
import { Filter, RefreshCw, Download, Crown, AlertTriangle } from 'lucide-react';
import { useDateRangeLimits } from '@/hooks/usePermissions';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface StationOption {
  id: string;
  name: string;
}

export interface PlanStatus {
  level: 'unlimited' | 'warning' | 'limited' | 'restricted' | 'blocked';
  limits?: {
    exports?: {
      allowed: boolean;
      quota: { usage: number; limit: number; remaining: number };
    };
  };
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
  /** Plan status for feature limitations */
  planStatus?: PlanStatus;
  /** Upgrade handler */
  onUpgrade?: () => void;
  /** Data type for date range limits (sales, profit, analytics, etc.) */
  dataType?: 'sales' | 'profit' | 'analytics' | 'audit' | 'transactions';
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
  planStatus,
  onUpgrade,
  dataType = 'analytics',
  className,
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const { getMaxDateForType } = useDateRangeLimits();

  const maxAllowedDate = getMaxDateForType(dataType);
  const maxDateString = maxAllowedDate.toISOString().split('T')[0];

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
                    max={maxDateString}
                    className="w-full py-3"
                    title={`Maximum date allowed: ${maxDateString}`}
                  />
                  <Input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) =>
                      onDateRangeChange({ ...dateRange, endDate: e.target.value })
                    }
                    max={new Date().toISOString().split('T')[0]}
                    min={dateRange.startDate}
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
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={onExportAll}
                      disabled={planStatus?.level === 'blocked' || (planStatus?.limits?.exports && !planStatus.limits.exports.allowed)}
                      variant={planStatus?.level === 'blocked' || (planStatus?.limits?.exports && !planStatus.limits.exports.allowed) ? 'outline' : 'default'}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {planStatus?.limits?.exports && !planStatus.limits.exports.allowed ? (
                        <>Export Limited</>
                      ) : planStatus?.level === 'blocked' ? (
                        <>Export Blocked</>
                      ) : (
                        <>Export All</>
                      )}
                    </Button>
                    
                    {/* Show usage info for limited plans */}
                    {planStatus?.limits?.exports && (
                      <div className="text-xs text-muted-foreground text-center">
                        {planStatus.limits.exports.quota.usage}/{planStatus.limits.exports.quota.limit} exports used
                        {planStatus.limits.exports.quota.remaining === 0 && (
                          <span className="text-destructive block">Limit reached - upgrade required</span>
                        )}
                      </div>
                    )}
                    
                    {/* Upgrade button for blocked/limited exports */}
                    {(planStatus?.level === 'blocked' || (planStatus?.limits?.exports && !planStatus.limits.exports.allowed)) && onUpgrade && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto text-xs"
                        onClick={onUpgrade}
                      >
                        <Crown className="w-3 h-3 mr-1" />
                        Upgrade for Unlimited Exports
                      </Button>
                    )}
                  </div>
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
