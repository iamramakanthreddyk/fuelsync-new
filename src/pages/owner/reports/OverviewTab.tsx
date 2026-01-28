import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { RevenueTrendChart } from './RevenueTrendChart';
import type { SalesReport } from '@/hooks/useReportData';

interface OverviewTabProps {
  aggregatedSalesReports: SalesReport[] | undefined;
  salesLoading: boolean;
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

export const OverviewTab: React.FC<OverviewTabProps> = ({
  aggregatedSalesReports,
  salesLoading,
  insights,
}) => {
  return (
    <TabsContent value="overview" className="space-y-2 md:space-y-3">
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <RevenueTrendChart
          salesReports={aggregatedSalesReports}
          isLoading={salesLoading}
          className="md:col-span-2"
        />

        {/* Additional insights charts can be added here */}
        {insights && (
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Fuel Type Distribution</h3>
            <div className="space-y-2">
              {insights.fuelTypeBreakdown.slice(0, 3).map((fuel, index) => (
                <div key={fuel.type} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{fuel.type}</span>
                  <span className="text-sm font-medium">{fuel.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </TabsContent>
  );
};
