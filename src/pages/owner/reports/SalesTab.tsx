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
}

export const SalesTab: React.FC<SalesTabProps> = ({
  aggregatedSalesReports,
  salesLoading,
  totals,
  onPrintPdf,
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
          {/* Grand Total Card */}
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
                </div>
              </div>
            </CardHeader>
          </Card>
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
