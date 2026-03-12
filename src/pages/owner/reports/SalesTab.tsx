import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { ReportSection, SalesReportCard } from '@/components/reports';
import { FileText } from 'lucide-react';
import { safeToFixed, formatCurrency } from '@/lib/format-utils';
import type { SalesReport } from '@/hooks/useReportData';

interface SalesTabProps {
  aggregatedSalesReports: SalesReport[] | undefined;
  salesLoading: boolean;
  totals: { sales: number; quantity: number; transactions: number };
  onPrintPdf: () => void;
  insights?: {
    avgTransactionValue: number;
    peakDay: SalesReport | null;
    fuelTypeBreakdown: Array<{
      type: string;
      sales: number;
      quantity: number;
      percentage: number;
    }>;
  };
}

export const SalesTab: React.FC<SalesTabProps> = ({
  aggregatedSalesReports,
  salesLoading,
  totals,
  onPrintPdf,
  insights,
}) => {
  // Compact metric card
  const MetricCard: React.FC<{ title: string; value: string | number; subtitle?: string; color?: string }> = ({ 
    title, 
    value, 
    subtitle,
    color = 'text-gray-700'
  }) => (
    <div className="rounded-lg border border-gray-200 bg-white p-3 hover:border-gray-300 transition-colors">
      <div className="text-xs font-medium text-gray-500 mb-1">{title}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
    </div>
  );

  // Compact station card
  const StationCard: React.FC<{ name: string; sales: number; quantity: number; transactions: number }> = ({ name, sales, quantity, transactions }) => (
    <div className="rounded-lg border border-gray-200 bg-white p-3 hover:border-gray-300 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
          <div className="text-xs text-gray-500">{transactions} txns</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold text-green-600">{formatCurrency(sales, 0)}</div>
          <div className="text-xs text-gray-500">{safeToFixed(quantity)} L</div>
        </div>
      </div>
    </div>
  );

  // Group aggregated reports by station
  const stationMap = (aggregatedSalesReports ?? []).reduce((map, r) => {
    const stationId = (r as any).stationId ?? 'unknown';
    const name = (r as any).stationName ?? stationId;
    const sales = Number((r as any).sales ?? (r as any).totalSales ?? 0);
    const quantity = Number((r as any).quantity ?? (r as any).litres ?? (r as any).totalQuantity ?? 0);
    const transactions = Number((r as any).transactions ?? (r as any).totalTransactions ?? 0);

    const prev = map.get(stationId) || { stationId, name, sales: 0, quantity: 0, transactions: 0 };
    prev.sales += Number.isFinite(sales) ? sales : 0;
    prev.quantity += Number.isFinite(quantity) ? quantity : 0;
    prev.transactions += Number.isFinite(transactions) ? transactions : 0;
    map.set(stationId, prev);
    return map;
  }, new Map<string, { stationId: string; name: string; sales: number; quantity: number; transactions: number }>());

  const stationAggregates = Array.from(stationMap.values());

  return (
    <TabsContent value="sales" className="space-y-3">
      <ReportSection
        title="Sales"
        description="By station & fuel type"
        isLoading={salesLoading}
        loadingText="Loading sales reports..."
        isEmpty={!aggregatedSalesReports || aggregatedSalesReports.length === 0}
        emptyState={{
          icon: FileText,
          title: 'No Sales Data',
          description: 'No sales found for the selected date range and filters',
        }}
        onPrintPdf={onPrintPdf}
      >
        <div className="space-y-3">
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <MetricCard 
              title="Total Sales" 
              value={formatCurrency(totals.sales, 0)}
              color="text-green-600"
            />
            <MetricCard 
              title="Volume" 
              value={`${safeToFixed(totals.quantity)} L`}
              color="text-blue-600"
            />
            <MetricCard 
              title="Transactions" 
              value={totals.transactions}
              color="text-purple-600"
            />
            {insights && (
              <MetricCard 
                title="Avg/Txn" 
                value={`₹${safeToFixed(insights.avgTransactionValue, 0)}`}
                color="text-orange-600"
              />
            )}
            {insights?.peakDay && (
              <MetricCard 
                title="Peak Day" 
                value={new Date(insights.peakDay.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                subtitle={formatCurrency(insights.peakDay.totalSales || 0, 0)}
              />
            )}
          </div>

          {/* Fuel Type Breakdown */}
          {insights && insights.fuelTypeBreakdown.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Fuel Mix</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {insights.fuelTypeBreakdown.slice(0, 5).map((f) => (
                  <div key={f.type} className="text-center p-1.5 rounded bg-gray-50">
                    <div className="text-xs font-medium text-gray-700 truncate">{f.type}</div>
                    <div className="text-xs font-bold text-gray-900">{f.percentage.toFixed(0)}%</div>
                    <div className="text-xs text-gray-500">{formatCurrency(f.sales, 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stations Overview */}
          {stationAggregates.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Stations</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {stationAggregates.map((s) => (
                  <StationCard key={s.stationId} name={s.name} sales={s.sales} quantity={s.quantity} transactions={s.transactions} />
                ))}
              </div>
            </div>
          )}

          {/* Detailed Sales Reports */}
          {(aggregatedSalesReports ?? []).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Daily Breakdown</h4>
              <div className="space-y-1.5">
                {(aggregatedSalesReports ?? []).map((report) => (
                  <SalesReportCard key={`${(report as any).stationId}-${(report as any).date}`} report={report} />
                ))}
              </div>
            </div>
          )}
        </div>
      </ReportSection>
    </TabsContent>
  );
};
