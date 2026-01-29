import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReportSection, SalesReportCard } from '@/components/reports';
import { FileText } from 'lucide-react';
import { safeToFixed } from '@/lib/format-utils';
import type { SalesReport } from '@/hooks/useReportData';
import { Badge } from '@/components/ui/badge';
import { getFuelColors } from '@/lib/fuelColors';

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
    efficiency: number;
  };
}

export const SalesTab: React.FC<SalesTabProps> = ({
  aggregatedSalesReports,
  salesLoading,
  totals,
  onPrintPdf,
  insights,
}) => {
  // small helper: KPI grid
  const KPIGrid: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">KPIs</CardTitle>
        <CardDescription className="text-xs">Quick metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-sm text-gray-500">Sales</div>
            <div className="font-semibold">₹{totals.sales.toLocaleString('en-IN')}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Volume</div>
            <div className="font-semibold">{safeToFixed(totals.quantity)} L</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Transactions</div>
            <div className="font-semibold">{totals.transactions}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // small helper: Fuel row with brand color
  const FuelRow: React.FC<{ type: string; sales: number }> = ({ type, sales }) => {
    const colors = getFuelColors(type);
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${colors.dot}`} />
          <div className="text-sm">{type}</div>
        </div>
        <div className="text-sm font-medium">₹{sales.toLocaleString('en-IN')}</div>
      </div>
    );
  };

  // small helper: Station card
  const StationCard: React.FC<{ name: string; sales: number; quantity: number; transactions: number }> = ({ name, sales, quantity, transactions }) => (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-medium">{name}</div>
            <div className="text-xs text-muted-foreground">{transactions} txns</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">₹{sales.toLocaleString('en-IN')}</div>
            <div className="text-xs text-muted-foreground">{safeToFixed(quantity)} L</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Group aggregated reports by station to show compact station cards
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
    <TabsContent value="sales" className="space-y-4">
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Grand Total</CardTitle>
                    <CardDescription>All stations, selected period</CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">₹{totals.sales.toLocaleString('en-IN')}</div>
                    <div className="text-sm text-muted-foreground">{safeToFixed(totals.quantity)} L • {totals.transactions} txns</div>
                    {insights && (
                      <div className="text-sm text-muted-foreground">Avg: ₹{safeToFixed(insights.avgTransactionValue)}</div>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="space-y-4">
              <KPIGrid />

              {insights && insights.fuelTypeBreakdown.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Fuel Type Performance</CardTitle>
                    <CardDescription className="text-xs">Revenue by fuel</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {insights.fuelTypeBreakdown.map((f) => (
                        <FuelRow key={f.type} type={f.type} sales={f.sales} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Stations Overview */}
          <div>
            <h4 className="text-sm font-medium mb-2">Stations</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stationAggregates.map((s) => (
                <StationCard key={s.stationId} name={s.name} sales={s.sales} quantity={s.quantity} transactions={s.transactions} />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {(aggregatedSalesReports ?? []).map((report) => (
              <SalesReportCard key={`${(report as any).stationId}-${(report as any).date}`} report={report} />
            ))}
          </div>
        </div>
      </ReportSection>
    </TabsContent>
  );
};
