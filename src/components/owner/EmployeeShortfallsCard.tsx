/**
 * Employee Shortfalls Card - Dashboard Component
 * Displays employee cash shortfalls with time-based tracking
 * Supports: Daily, Weekly, Monthly, Yearly views
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, TrendingDown } from 'lucide-react';
import { useEmployeeShortfalls } from '@/hooks/useEmployeeShortfalls';
import { safeToFixed } from '@/lib/format-utils';
import { Button } from '@/components/ui/button';

interface EmployeeShortfallsCardProps {
  stationId?: string;
  onViewDetails?: () => void;
}

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const EmployeeShortfallsCard: React.FC<EmployeeShortfallsCardProps> = ({
  stationId,
  onViewDetails
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('monthly');
  
  // Calculate date ranges based on selected period
  const getDateRange = (period: TimePeriod) => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const endDate = today.toISOString().split('T')[0];

    switch (period) {
      case 'daily':
        return {
          startDate: startOfDay.toISOString().split('T')[0],
          endDate
        };
      case 'weekly':
        return {
          startDate: startOfWeek.toISOString().split('T')[0],
          endDate
        };
      case 'monthly':
        return {
          startDate: startOfMonth.toISOString().split('T')[0],
          endDate
        };
      case 'yearly':
        return {
          startDate: startOfYear.toISOString().split('T')[0],
          endDate
        };
      default:
        return { startDate: startOfMonth.toISOString().split('T')[0], endDate };
    }
  };

  const dateRange = getDateRange(selectedPeriod);
  const { data: shortfallsData, isLoading } = useEmployeeShortfalls(
    stationId,
    dateRange.startDate,
    dateRange.endDate
  );

  const hasShortfalls = !!shortfallsData && shortfallsData.data.length > 0;
  const summary = shortfallsData?.summary;

  // Sort employees by shortfall amount (descending)
  const sortedEmployees = shortfallsData?.data
    .sort((a, b) => b.totalShortfall - a.totalShortfall)
    .slice(0, 5) ?? [];

  const getPeriodLabel = (period: TimePeriod) => {
    const today = new Date();
    switch (period) {
      case 'daily':
        return `Today (${today.toLocaleDateString()})`;
      case 'weekly':
        return `This Week`;
      case 'monthly':
        return `This Month`;
      case 'yearly':
        return `This Year`;
      default:
        return 'Period';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            Employee Cash Shortfalls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-muted-foreground">Loading shortfall data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={hasShortfalls ? 'border-red-200 bg-red-50/30' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              Employee Cash Shortfalls
            </CardTitle>
            <CardDescription className="mt-1">
              Track employee shortfalls over time
            </CardDescription>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 mt-4">
          {(['daily', 'weekly', 'monthly', 'yearly'] as TimePeriod[]).map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
              className="capitalize"
            >
              {period}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasShortfalls ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="w-10 h-10 text-green-600 mb-3" />
            <h4 className="font-medium text-green-900">No Shortfalls</h4>
            <p className="text-sm text-green-700 mt-1">
              All employees are current on their cash for {getPeriodLabel(selectedPeriod).toLowerCase()}
            </p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="p-3 rounded-md bg-white/50 border border-red-200">
                <div className="text-xs font-medium text-muted-foreground">Total Shortfall</div>
                <div className="text-lg sm:text-xl font-bold text-red-700">
                  ₹{summary ? safeToFixed(summary.totalShortfall, 0) : '0'}
                </div>
              </div>
              <div className="p-3 rounded-md bg-white/50 border border-red-200">
                <div className="text-xs font-medium text-muted-foreground">Employees</div>
                <div className="text-lg sm:text-xl font-bold text-red-700">
                  {summary?.employeesAffected ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-md bg-white/50 border border-red-200">
                <div className="text-xs font-medium text-muted-foreground">Days Affected</div>
                <div className="text-lg sm:text-xl font-bold text-red-700">
                  {summary?.totalDaysWithShortfall ?? 0}
                </div>
              </div>
            </div>

            {/* Top Offenders */}
            {sortedEmployees.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900">Top Shortfall Cases</h4>
                <div className="space-y-2">
                  {sortedEmployees.map((employee, index) => (
                    <div
                      key={`${employee.employeeId}-${index}`}
                      className="flex items-center justify-between p-2 rounded-md bg-white/50 border border-red-100"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {employee.employeeName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {employee.daysWithShortfall} day{employee.daysWithShortfall !== 1 ? 's' : ''} • Avg: ₹{safeToFixed(employee.averagePerDay, 0)}
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <div className="text-sm font-bold text-red-700">
                          ₹{safeToFixed(employee.totalShortfall, 0)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View Details Button */}
            {onViewDetails && (
              <button
                onClick={onViewDetails}
                className="w-full mt-4 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md border border-blue-200"
              >
                View Detailed Report →
              </button>
            )}

            {/* Info Note */}
            <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-700">
              <strong>Note:</strong> Shortfalls are detected from daily settlements. Navigate to the Employees tab for comprehensive historical analysis.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
