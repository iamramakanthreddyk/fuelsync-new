import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReportSection, SalesReportCard } from '@/components/reports';
import { FileText } from 'lucide-react';
import { safeToFixed } from '@/lib/format-utils';
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
  return (
    <TabsContent value="sales" className="space-y-2">
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
        <div>
          {/* Enhanced Grand Total Card */}
          <Card className="mb-3 md:mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm md:text-lg">Grand Total</CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    All stations, selected period
                  </CardDescription>
                </div>
                <div className="text-right ml-2">
                  <div className="text-lg md:text-2xl font-bold text-green-600">
                    ₹{totals.sales.toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {safeToFixed(totals.quantity)} L
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {totals.transactions} txns
                  </p>
                  {insights && (
                    <p className="text-xs text-muted-foreground">
                      Avg: ₹{safeToFixed(insights.avgTransactionValue)}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Fuel Type Summary */}
          {insights && insights.fuelTypeBreakdown.length > 0 && (
            <Card className="mb-3 md:mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm md:text-base">Fuel Type Performance</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Revenue breakdown by fuel type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {insights.fuelTypeBreakdown.map((fuel) => (
                    <div key={fuel.type} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{fuel.type}</span>
                        <span className="text-xs text-gray-500">{fuel.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="text-lg font-bold text-green-600">
                        ₹{fuel.sales.toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-gray-600">
                        {safeToFixed(fuel.quantity)} L
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {(aggregatedSalesReports ?? []).map((report) => (
              <SalesReportCard
                key={`${report.stationId}-${report.date}`}
                report={report}
              />
            ))}
          </div>
        </div>
      </ReportSection>
    </TabsContent>
  );
};
