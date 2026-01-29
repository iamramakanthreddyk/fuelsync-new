import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Bar
} from 'recharts';
import type { Settlement } from '@/hooks/useReportData';

interface VarianceAnalysisChartProps {
  settlements: Settlement[] | undefined;
  isLoading: boolean;
  className?: string;
}

export const VarianceAnalysisChart: React.FC<VarianceAnalysisChartProps> = ({
  settlements,
  isLoading,
  className = '',
}) => {
  const formatCurrency = (v: number) => {
    if (!Number.isFinite(v)) return '—';
    // Use compact for small axis, full for labels
    return `₹${v.toLocaleString('en-IN')}`;
  };

  const formatAxisTick = (v: number) => {
    if (!Number.isFinite(v)) return '';
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `₹${(v / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `₹${(v / 1_000).toFixed(1)}k`;
    return `₹${v.toLocaleString('en-IN')}`;
  };
  // Transform settlement data for the chart
  const chartData = React.useMemo(() => {
    if (!settlements || settlements.length === 0) return [];

    // Group settlements by date and aggregate across stations
    const groupedByDate = settlements.reduce((acc, settlement) => {
      const dateKey = settlement.date;
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          expected: 0,
          actual: 0,
          variance: 0,
          count: 0,
          stations: [],
        };
      }

      // API returns DECIMAL fields as strings; coerce to numbers safely
      const empCash = Number(parseFloat(String(settlement.employeeCash || 0)) || 0);
      const empOnline = Number(parseFloat(String(settlement.employeeOnline || 0)) || 0);
      const empCredit = Number(parseFloat(String(settlement.employeeCredit || 0)) || 0);

      const ownerActualCash = Number(parseFloat(String(settlement.actualCash || 0)) || 0);
      const ownerOnline = Number(parseFloat(String(settlement.online || 0)) || 0);
      const ownerCredit = Number(parseFloat(String(settlement.credit || 0)) || 0);

      const expectedTotal = empCash + empOnline + empCredit;
      const actualTotal = ownerActualCash + ownerOnline + ownerCredit;
      const variance = Number((actualTotal - expectedTotal) || 0);

      acc[dateKey].expected += expectedTotal;
      acc[dateKey].actual += actualTotal;
      acc[dateKey].variance += variance;
      acc[dateKey].count += 1;
      acc[dateKey].stations.push({
        name: settlement.stationName || 'Unknown Station',
        expected: expectedTotal,
        actual: actualTotal,
        variance: variance,
      });

      return acc;
    }, {} as Record<string, any>);

    return Object.values(groupedByDate)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((item: any) => ({
        date: new Date(item.date).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric'
        }),
        fullDate: item.date,
        expected: Number(item.expected || 0),
        actual: Number(item.actual || 0),
        variance: Number(item.variance || 0),
        varianceAbs: Math.abs(Number(item.variance || 0)),
        stationCount: item.count,
        stations: item.stations,
      }));
  }, [settlements]);

  if (isLoading) {
    return (
      <div className={`bg-white/80 backdrop-blur-sm rounded-lg p-6 border border-gray-200 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className={`bg-white/80 backdrop-blur-sm rounded-lg p-6 border border-gray-200 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Variance Analysis</h3>
        <p className="text-gray-500 text-sm">No settlement data available for the selected period.</p>
      </div>
    );
  }

  // Calculate summary stats
  const totalExpected = chartData.reduce((sum, d) => sum + Number(d.expected || 0), 0);
  const totalActual = chartData.reduce((sum, d) => sum + Number(d.actual || 0), 0);
  const totalVariance = chartData.reduce((sum, d) => sum + Number(d.variance || 0), 0);
  const avgVariance = totalVariance / chartData.length;

  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-lg p-6 border border-gray-200 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Settlement Variance Analysis</h3>
          <p className="text-sm text-gray-600">Reported vs Actual Cash Collection</p>
        </div>
        <div className="text-right text-sm">
          <div className="text-gray-600">Total Variance</div>
          <div className={`font-bold ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {Number.isFinite(totalVariance) ? `${totalVariance >= 0 ? '+' : ''}₹${Math.abs(totalVariance).toLocaleString('en-IN')}` : '—'}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-xs text-blue-600 font-medium">Expected</div>
          <div className="text-lg font-bold text-blue-700">{Number.isFinite(totalExpected) ? `₹${totalExpected.toLocaleString('en-IN')}` : '—'}</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-xs text-green-600 font-medium">Actual</div>
          <div className="text-lg font-bold text-green-700">{Number.isFinite(totalActual) ? `₹${totalActual.toLocaleString('en-IN')}` : '—'}</div>
        </div>
        <div className={`p-3 rounded-lg ${totalVariance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className={`text-xs font-medium ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Variance
          </div>
          <div className={`text-lg font-bold ${totalVariance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {Number.isFinite(totalVariance) ? `${totalVariance >= 0 ? '+' : ''}₹${Math.abs(totalVariance).toLocaleString('en-IN')}` : '—'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              stroke="#666"
              fontSize={12}
              tick={{ fill: '#666' }}
            />
            <YAxis
              stroke="#666"
              fontSize={12}
              tick={{ fill: '#666' }}
              tickFormatter={formatAxisTick}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-w-xs">
                      <p className="font-medium text-gray-900">{data.fullDate}</p>
                      <div className="space-y-2 text-sm mt-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-blue-500 rounded" />
                          <span>Expected: {formatCurrency(Number(data.expected || 0))}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded" />
                          <span>Actual: {formatCurrency(Number(data.actual || 0))}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded ${data.variance >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span>Variance: {data.variance >= 0 ? '+' : ''}{formatCurrency(Number(data.variance || 0))}</span>
                        </div>

                        {data.stationCount > 0 && (
                          <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                            <div className="font-medium mb-1">Stations ({data.stationCount}):</div>
                            <div className="max-h-40 overflow-auto pr-2">
                              {data.stations.map((station: any, idx: number) => (
                                <div key={`${station.name}-${idx}`} className="text-xs flex justify-between">
                                  <span className="truncate pr-2">{station.name}</span>
                                  <span className={`font-medium ${station.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {station.variance >= 0 ? '+' : ''}{formatCurrency(Number(station.variance || 0))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />

            {/* Expected Line */}
            <Line
              type="monotone"
              dataKey="expected"
              stroke="#3b82f6"
              strokeWidth={3}
              name="Expected (Reported)"
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
            />

            {/* Actual Line */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#10b981"
              strokeWidth={3}
              name="Actual (Received)"
              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
            />

            {/* Variance Area */}
            <Area
              type="monotone"
              dataKey="variance"
              stroke="#f59e0b"
              fill="#fef3c7"
              strokeWidth={2}
              name="Variance"
              fillOpacity={0.6}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Key Insights</h4>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-600">Avg Daily Variance:</span>
            <span className={`ml-1 font-medium ${avgVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {avgVariance >= 0 ? '+' : ''}₹{avgVariance.toFixed(0)}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Best Day:</span>
            <span className="ml-1 font-medium text-green-600">
              {chartData.reduce((best, current) =>
                Math.abs(current.variance) < Math.abs(best.variance) ? current : best
              ).date}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};