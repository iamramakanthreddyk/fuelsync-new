/**
 * DateRangeFilter Component
 * Global, reusable date range picker with plan-based date limits
 * 
 * Features:
 * - Native date inputs (type="date") with dd/mm/yyyy display labels
 * - Plan-based date constraints via useDateRangeLimits hook
 * - Optional preset ranges (Last 7/30 days, This month, etc.)
 * - Always restricted to today as max date
 */

import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useDateRangeLimits } from '@/hooks/usePermissions';

interface DateRangeFilterProps {
  /** Start date in YYYY-MM-DD format */
  startDate: string;
  /** End date in YYYY-MM-DD format */
  endDate: string;
  /** Called when date range changes */
  onDateRangeChange: (startDate: string, endDate: string) => void;
  /** Plan type for date limits (sales, profit, analytics, audit, transactions) */
  dataType?: 'sales' | 'profit' | 'analytics' | 'audit' | 'transactions';
  /** Show preset quick-pick buttons (Last 7 days, Last 30 days, etc.) */
  showPresets?: boolean;
  /** Custom label for the filter section */
  label?: string;
  /** Optional container className */
  className?: string;
}

/** Format YYYY-MM-DD → DD/MM/YYYY for display */
const formatDDMMYYYY = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/** Get YYYY-MM-DD string for a Date object */
const toISODateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  onDateRangeChange,
  dataType = 'analytics',
  showPresets = false,
  label = 'Date Range',
  className,
}) => {
  const { getMaxDateForType } = useDateRangeLimits();

  const today = useMemo(() => toISODateString(new Date()), []);
  const earliestAllowedDate = useMemo(() => getMaxDateForType(dataType), [dataType, getMaxDateForType]);
  const minDateString = useMemo(
    () => (earliestAllowedDate > new Date() ? '' : earliestAllowedDate.toISOString().split('T')[0]),
    [earliestAllowedDate]
  );

  /** Preset: Last N days */
  const setLastNDays = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    
    const startStr = toISODateString(start);
    const endStr = toISODateString(end);
    
    // Respect minimum date constraint
    if (minDateString && startStr < minDateString) {
      onDateRangeChange(minDateString, endStr);
    } else {
      onDateRangeChange(startStr, endStr);
    }
  };

  /** Preset: This month (start of month to today) */
  const setThisMonth = () => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    
    const startStr = toISODateString(start);
    const endStr = toISODateString(end);
    
    if (minDateString && startStr < minDateString) {
      onDateRangeChange(minDateString, endStr);
    } else {
      onDateRangeChange(startStr, endStr);
    }
  };

  return (
    <div className={className || 'space-y-3'}>
      <Label className="text-sm font-medium">{label}</Label>
      
      {/* Date Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => onDateRangeChange(e.target.value, endDate)}
            min={minDateString || undefined}
            max={today}
            className="w-full py-2"
            aria-label="Start date"
          />
          {startDate && <p className="text-xs text-muted-foreground pl-1">{formatDDMMYYYY(startDate)}</p>}
        </div>
        <div className="space-y-1">
          <Input
            type="date"
            value={endDate}
            onChange={(e) => onDateRangeChange(startDate, e.target.value)}
            min={startDate || minDateString || undefined}
            max={today}
            className="w-full py-2"
            aria-label="End date"
          />
          {endDate && <p className="text-xs text-muted-foreground pl-1">{formatDDMMYYYY(endDate)}</p>}
        </div>
      </div>

      {/* Optional Preset Buttons */}
      {showPresets && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => setLastNDays(7)}
          >
            Last 7 days
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => setLastNDays(30)}
          >
            Last 30 days
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={setThisMonth}
          >
            This month
          </Button>
        </div>
      )}
    </div>
  );
};
