import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Settlement } from '@/hooks/useReportData';
import { formatCurrency as globalFormatCurrency, formatNumber } from '@/lib/format-utils';

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
  const [activeTab, setActiveTab] = useState('comparison');

  const formatCurencyDisplay = (v: number) => {
    if (!Number.isFinite(v)) return '—';
    return globalFormatCurrency(v, 0);
  };

  const formatAxisTick = (v: number) => {
    if (!Number.isFinite(v)) return '';
    const abs = Math.abs(v);
    if (abs >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (abs >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
    return globalFormatCurrency(v, 0);
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
      // Use the backend-calculated expectedCash (from live transactions) and actualCash
      const expectedCash = Number(parseFloat(String(settlement.expectedCash || 0)) || 0);
      const actualCash = Number(parseFloat(String(settlement.actualCash || 0)) || 0);
      
      // Variance is expected - actual (positive = shortfall, negative = overage)
      const variance = Number(parseFloat(String(settlement.variance || 0)) || 0);

      acc[dateKey].expected += expectedCash;
      acc[dateKey].actual += actualCash;
      acc[dateKey].variance += variance;
      acc[dateKey].count += 1;
      acc[dateKey].stations.push({
        name: settlement.stationName || 'Unknown Station',
        expected: expectedCash,
        actual: actualCash,
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
        variancePercent: item.expected > 0 ? ((Number(item.variance || 0) / item.expected) * 100) : 0,
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
          <div className={`font-bold ${totalVariance > 0 ? 'text-red-600' : totalVariance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
            {Number.isFinite(totalVariance) ? (totalVariance > 0 ? '−' : '+') + '₹' + Math.abs(totalVariance).toLocaleString('en-IN') : '—'}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-xs text-blue-600 font-medium">Expected</div>
          <div className="text-lg font-bold text-blue-700">{Number.isFinite(totalExpected) ? globalFormatCurrency(totalExpected, 0) : '—'}</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-xs text-green-600 font-medium">Actual</div>
          <div className="text-lg font-bold text-green-700">{Number.isFinite(totalActual) ? globalFormatCurrency(totalActual, 0) : '—'}</div>
        </div>
        <div className={`p-3 rounded-lg ${totalVariance > 0 ? 'bg-red-50' : totalVariance < 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
          <div className={`text-xs font-medium ${totalVariance > 0 ? 'text-red-600' : totalVariance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
            Variance
          </div>
          <div className={`text-lg font-bold ${totalVariance > 0 ? 'text-red-700' : totalVariance < 0 ? 'text-green-700' : 'text-gray-700'}`}>
            {Number.isFinite(totalVariance) ? (totalVariance > 0 ? '−₹' : totalVariance < 0 ? '+₹' : '₹') + Math.abs(totalVariance).toLocaleString('en-IN') : '—'}
          </div>
        </div>
      </div>

      {/* Chart View Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="comparison">Side-by-Side Comparison</TabsTrigger>
          <TabsTrigger value="trend">Variance Trend</TabsTrigger>
        </TabsList>

        {/* View 1: Bar Chart Comparison (Expected vs Actual Side-by-Side) */}
        <TabsContent value="comparison" className="mt-4">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                          <p className="font-medium text-gray-900">{data.fullDate}</p>
                          <div className="space-y-2 text-sm mt-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-500 rounded" />
                              <span>Expected: {formatCurencyDisplay(Number(data.expected))}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded" />
                              <span>Actual: {formatCurencyDisplay(Number(data.actual))}</span>
                            </div>
                            <div className="border-t pt-2 mt-2">
                              <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded ${data.variance > 0 ? 'bg-red-500' : data.variance < 0 ? 'bg-green-500' : 'bg-gray-500'}`} />
                              <span className={`font-medium ${data.variance > 0 ? 'text-red-700' : data.variance < 0 ? 'text-green-700' : 'text-gray-700'}`}>
                                {data.variance > 0 ? '⚠️ SHORTFALL: −₹' : data.variance < 0 ? '✓ OVERAGE: +₹' : 'BALANCED: ₹'}{formatCurencyDisplay(Math.abs(Number(data.variance)))} ({Math.abs(data.variancePercent).toFixed(1)}% of expected)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="square"
                />
                <Bar dataKey="expected" fill="#3b82f6" name="Expected (Reported)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="#10b981" name="Actual (Received)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* View 2: Variance Trend Line with Color-Coded Bars */}
        <TabsContent value="trend" className="mt-4">
          <div className="h-96">
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
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                          <p className="font-medium text-gray-900">{data.fullDate}</p>
                          <div className="space-y-2 text-sm mt-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded ${data.variance >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span className={`font-medium ${data.variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                Variance: {data.variance >= 0 ? '+' : ''}{formatCurencyDisplay(Number(data.variance))}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600">
                              {data.variancePercent?.toFixed(1)}% of expected
                            </div>
                            {data.stationCount > 0 && (
                              <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                                <div className="font-medium mb-1">Stations ({data.stationCount}):</div>
                                <div className="max-h-32 overflow-auto">
                                  {data.stations.map((station: any, idx: number) => (
                                    <div key={`${station.name}-${idx}`} className="flex justify-between">
                                      <span className="truncate pr-2">{station.name}</span>
                                      <span className={`font-medium whitespace-nowrap ${station.variance > 0 ? 'text-red-600' : station.variance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                        {station.variance > 0 ? '−₹' : station.variance < 0 ? '+₹' : '₹'}{formatCurencyDisplay(Math.abs(Number(station.variance)))}
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
                <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                <Legend />
                <Bar dataKey="variance" fillOpacity={0.8} radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.variance > 0 ? '#ef4444' : entry.variance < 0 ? '#10b981' : '#6b7280'} />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="variance"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, stroke: '#f59e0b', strokeWidth: 2 }}
                  name="Variance Trend"
                  isAnimationActive={true}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>

      {/* Insights */}
      <div className="mt-6 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Key Insights</h4>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-600">Avg Daily Variance:</span>
            <span className={`ml-1 font-medium ${avgVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {avgVariance >= 0 ? '+' : ''}₹{avgVariance.toFixed(0)}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Highest Variance:</span>
            <span className="ml-1 font-medium text-blue-600">
              {chartData.reduce((max, current) =>
                Math.abs(current.variance) > Math.abs(max.variance) ? current : max
              ).date}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Collection Efficiency:</span>
            <span className="ml-1 font-medium text-blue-600">
              {totalExpected > 0 ? `${((totalActual / totalExpected) * 100).toFixed(1)}%` : '—'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Days with Variance:</span>
            <span className="ml-1 font-medium text-blue-600">
              {chartData.filter(d => d.variance !== 0).length} / {chartData.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}