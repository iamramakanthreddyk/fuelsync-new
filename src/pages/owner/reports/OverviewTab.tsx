import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { RevenueTrendChart } from './RevenueTrendChart';
import type { SalesReport } from '@/hooks/useReportData';

interface OverviewTabProps {
  aggregatedSalesReports: SalesReport[] | undefined;
  salesLoading: boolean;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  aggregatedSalesReports,
  salesLoading,
}) => {
  return (
    <TabsContent value="overview" className="space-y-2 md:space-y-3">
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <RevenueTrendChart
          salesReports={aggregatedSalesReports}
          isLoading={salesLoading}
          className="md:col-span-2"
        />
      </div>
    </TabsContent>
  );
};
