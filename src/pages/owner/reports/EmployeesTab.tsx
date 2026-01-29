import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReportSection, StatCard } from '@/components/reports';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { safeToFixed } from '@/lib/format-utils';
import { useToast } from '@/hooks/use-toast';
import { printShortfallReport } from '@/lib/report-export';
import {
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  Users,
  AlertTriangle,
} from 'lucide-react';
import type { DateRange } from '@/components/reports';

export interface EmployeeShortfallData {
  employeeName: string;
  totalShortfall: number;
  daysWithShortfall: number;
  averagePerDay: number;
  settlementsCount: number;
  shortfallDates?: string[];
  lastShortfallDate?: string;
  employeeId?: string;
}

interface EmployeesTabProps {
  dateRange: DateRange;
  selectedStation: string;
}

export const EmployeesTab: React.FC<EmployeesTabProps> = ({
  dateRange,
  selectedStation,
}) => {
  const { toast } = useToast();
  const [endpointAvailable, setEndpointAvailable] = useState(true);

  // Fetch shortfall data from backend
  const { data: shortfallData, isLoading: shortfallLoading } = useQuery({
    queryKey: ['employee-shortfalls', selectedStation, dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      const hasValidDates = dateRange?.startDate && dateRange?.endDate;
      const hasValidStation = selectedStation && selectedStation !== '';
      
      if (!hasValidStation || !hasValidDates) {
        console.warn('[EmployeeShortfallReport] Missing required params:', { selectedStation, dateRange });
        return [];
      }
      
      try {
        const response = await apiClient.get<any>(
          `/stations/${selectedStation}/employee-shortfalls`,
          {
            params: {
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
            },
          }
        );
        
        setEndpointAvailable(true);
        
        if (response?.data?.data && Array.isArray(response.data.data)) {
          return response.data.data;
        }
        if (response?.data && Array.isArray(response.data)) {
          return response.data;
        }
        return [];
      } catch (error: any) {
        if (error?.response?.status === 404) {
          setEndpointAvailable(false);
          console.warn('[EmployeeShortfallReport] Endpoint not yet available on backend');
        } else {
          console.error('[EmployeeShortfallReport] Failed to fetch employee shortfalls:', error);
        }
        return [];
      }
    },
    enabled: !!(selectedStation && dateRange?.startDate && dateRange?.endDate),
  });

  const employeeShortfalls: EmployeeShortfallData[] = shortfallData ?? [];

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (employeeShortfalls.length === 0) {
      return {
        totalShortfall: 0,
        employeesAffected: 0,
        averageShortfallPerEmployee: 0,
        highestShortfallEmployee: null as EmployeeShortfallData | null,
      };
    }

    const totalShortfall = employeeShortfalls.reduce((sum, e) => sum + e.totalShortfall, 0);
    const employeesAffected = employeeShortfalls.length;
    const averageShortfallPerEmployee = totalShortfall / employeesAffected;
    const highestShortfallEmployee = employeeShortfalls.reduce((max, e) => 
      e.totalShortfall > max.totalShortfall ? e : max
    );

    return {
      totalShortfall,
      employeesAffected,
      averageShortfallPerEmployee,
      highestShortfallEmployee,
    };
  }, [employeeShortfalls]);

  return (
    <TabsContent value="employees" className="space-y-4">
      <>
        {!endpointAvailable && !shortfallLoading && (
          <Card className="border-amber-200 bg-amber-50 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-900 mb-1">Backend Setup Required</h3>
                  <p className="text-sm text-amber-800 mb-3">
                    The Employee Shortfall report is ready on the frontend, but requires a backend endpoint to display data.
                  </p>
                  <div className="text-xs text-amber-700 bg-white p-3 rounded font-mono space-y-1 max-w-md">
                    <div><strong>Endpoint needed:</strong></div>
                    <div className="text-amber-600">GET /api/v1/stations/:stationId/employee-shortfalls</div>
                    <div><strong>Parameters:</strong> startDate, endDate</div>
                    <div className="mt-2"><strong>See:</strong> EMPLOYEE_SHORTFALL_API_SPEC.md for full implementation details</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {employeeShortfalls.length > 0 && !shortfallLoading && !employeeShortfalls[0].lastShortfallDate && (
          <Card className="border-blue-200 bg-blue-50 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">Enhanced Date Tracking Coming Soon</h3>
                  <p className="text-sm text-blue-800">
                    The backend API currently provides shortfall totals. To see specific dates when shortfalls occurred, the backend needs to include <code className="bg-white px-2 py-1 rounded text-blue-700 font-mono text-xs">lastShortfallDate</code> and <code className="bg-white px-2 py-1 rounded text-blue-700 font-mono text-xs">shortfallDates[]</code> in the response.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <ReportSection
          title="Employee Cash Shortfall Analysis"
          description="Track which employees reported shortfalls and the trend over the selected period"
          isLoading={shortfallLoading}
          loadingText="Loading employee shortfall data..."
          isEmpty={employeeShortfalls.length === 0 && endpointAvailable}
          emptyState={{
            icon: CheckCircle2,
            title: 'No Shortfalls',
            description: 'No cash shortfalls recorded for the selected period.',
          }}
          onPrintPdf={() => {
            if (employeeShortfalls?.length) {
              printShortfallReport(employeeShortfalls, dateRange, () => {
                toast({
                  title: 'Popup blocked',
                  description: 'Please allow popups to use Print/PDF export.',
                });
              });
            }
          }}
        >
          {!endpointAvailable ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Feature Not Yet Available</h3>
              <p className="text-slate-600 mb-4 max-w-md mx-auto">
                The backend endpoint for employee shortfall analysis has not been implemented yet. 
                Check the documentation to set it up.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <StatCard
                    icon={TrendingDown}
                    title="Total Cash Loss"
                    value={`₹${safeToFixed(summaryStats.totalShortfall, 2)}`}
                    trend={summaryStats.totalShortfall > 0 ? { value: 0, direction: 'down' as const } : { value: 0, direction: 'neutral' as const }}
                    variant="red"
                  />
                  <StatCard
                    icon={Users}
                    title="Employees Involved"
                    value={`${summaryStats.employeesAffected}`}
                    variant="teal"
                  />
                  <StatCard
                    icon={AlertCircle}
                    title="Avg Days with Loss"
                    value={`${safeToFixed(employeeShortfalls.reduce((sum, emp) => sum + emp.daysWithShortfall, 0) / employeeShortfalls.length || 0, 1)}`}
                    variant="orange"
                  />
                  {summaryStats.highestShortfallEmployee && (
                    <StatCard
                      icon={AlertTriangle}
                      title="Worst Performer"
                      value={summaryStats.highestShortfallEmployee.employeeName}
                      variant="purple"
                    />
                  )}
              </div>

              {/* Employee Shortfall Table - Responsive */}
              {employeeShortfalls.length > 0 && (
                <Card className="border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-red-600" />
                      Employee Shortfall Breakdown
                    </CardTitle>
                    <CardDescription>
                      Sorted by highest to lowest shortfall amount
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Desktop Table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-2 px-3 font-semibold text-slate-700">Employee</th>
                            <th className="text-right py-2 px-3 font-semibold text-slate-700">Total Shortfall</th>
                            <th className="text-right py-2 px-3 font-semibold text-slate-700">Days with Shortfall</th>
                            <th className="text-right py-2 px-3 font-semibold text-slate-700">Avg / Day</th>
                            {employeeShortfalls[0]?.lastShortfallDate && (
                              <th className="text-right py-2 px-3 font-semibold text-slate-700">Last Shortfall Date</th>
                            )}
                            <th className="text-right py-2 px-3 font-semibold text-slate-700">Severity</th>
                            <th className="text-right py-2 px-3 font-semibold text-slate-700">Settlements</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeeShortfalls
                            .sort((a, b) => b.totalShortfall - a.totalShortfall)
                            .map((emp, idx) => (
                              <tr
                                key={idx}
                                className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                                  emp.totalShortfall > 0 ? 'bg-red-50' : ''
                                }`}
                              >
                                <td className="py-3 px-3">
                                  <div className="font-medium text-slate-900">{emp.employeeName}</div>
                                </td>
                                <td className="text-right py-3 px-3">
                                  <div className="font-bold text-red-600">
                                    ₹{safeToFixed(emp.totalShortfall, 2)}
                                  </div>
                                </td>
                                <td className="text-right py-3 px-3">
                                  <div className="text-slate-600">{emp.daysWithShortfall} days</div>
                                </td>
                                <td className="text-right py-3 px-3">
                                  <div className="text-orange-600 font-semibold">
                                    ₹{safeToFixed(emp.averagePerDay, 2)}
                                  </div>
                                </td>
                                {emp.lastShortfallDate && (
                                  <td className="text-right py-3 px-3">
                                    <div 
                                      className="text-slate-600 text-sm cursor-help border-b border-dotted border-slate-300 w-fit ml-auto"
                                      title={`All shortfall dates: ${emp.shortfallDates?.map(d => new Date(d).toLocaleDateString('en-IN')).join(', ')}`}
                                    >
                                      {new Date(emp.lastShortfallDate).toLocaleDateString('en-IN')}
                                    </div>
                                  </td>
                                )}
                                {/* Severity column */}
                                <td className="text-right py-3 px-3">
                                  {(() => {
                                    const amount = Number(emp.totalShortfall ?? 0);
                                    const severity = amount > 1000 ? 'High' : amount > 250 ? 'Medium' : 'Low';
                                    const sevClass = severity === 'High' ? 'bg-red-600 text-white' : severity === 'Medium' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white';
                                    return (
                                      <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${sevClass}`}>
                                        {severity}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="text-right py-3 px-3">
                                  <div className="text-slate-600">{emp.settlementsCount}</div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Mobile Summary Card with List - Only one card rendered */}
                    <div className="sm:hidden">
                      <div className="space-y-3">
                        {employeeShortfalls
                          .sort((a, b) => b.totalShortfall - a.totalShortfall)
                            .map((emp, idx, arr) => {
                            const positive = (emp.totalShortfall ?? 0) > 0;
                            const accent = positive ? 'bg-red-500' : 'bg-slate-300';
                            return (
                              <div
                                key={idx}
                                role="button"
                                tabIndex={0}
                                aria-label={`${emp.employeeName} shortfall ${safeToFixed(emp.totalShortfall, 2)}`}
                                className="flex items-stretch rounded-lg border border-slate-100 bg-white shadow-sm overflow-hidden"
                              >
                                <div className={`${accent} w-1`} />
                                <div className="flex-1 p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium text-slate-900">{emp.employeeName}</div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-sm font-bold text-slate-800">₹{safeToFixed(emp.totalShortfall, 2)}</div>
                                      {/* Severity badge */}
                                      {(() => {
                                        const amt = Number(emp.totalShortfall ?? 0);
                                        const sev = amt > 1000 ? 'High' : amt > 250 ? 'Medium' : 'Low';
                                        const sevBadge = sev === 'High' ? 'bg-red-600 text-white' : sev === 'Medium' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white';
                                        return <div className={`text-xs px-2 py-0.5 rounded ${sevBadge}`}>{sev}</div>;
                                      })()}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap text-xs text-slate-600 gap-x-3 gap-y-1 mt-2">
                                    <div><span className="font-semibold">Days:</span> {emp.daysWithShortfall}</div>
                                    <div><span className="font-semibold">Avg/Day:</span> ₹{safeToFixed(emp.averagePerDay, 2)}</div>
                                    {emp.lastShortfallDate && (
                                      <div>
                                        <span className="font-semibold">Last:</span>{' '}
                                        <span
                                          title={emp.shortfallDates?.map(d => new Date(d).toLocaleDateString('en-IN')).join(', ')}
                                          className="cursor-help border-b border-dotted border-slate-300"
                                        >
                                          {new Date(emp.lastShortfallDate).toLocaleDateString('en-IN')}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </ReportSection>
      </>
    </TabsContent>
  );
};
