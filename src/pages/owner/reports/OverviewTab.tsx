import React, { useMemo } from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { RevenueTrendChart } from './RevenueTrendChart';
import { VarianceAnalysisChart } from './VarianceAnalysisChart';
import type { SalesReport, Settlement } from '@/hooks/useReportData';
import { useVarianceSummary } from '@/hooks/useVarianceSummary';

interface OverviewTabProps {
  aggregatedSalesReports: SalesReport[] | undefined;
  salesLoading: boolean;
  settlements: Settlement[] | undefined;
  settlementsLoading: boolean;
  dateRange?: { startDate: string; endDate: string };
  selectedStation?: string;
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

export const OverviewTab: React.FC<OverviewTabProps> = ({
  aggregatedSalesReports,
  salesLoading,
  settlements,
  settlementsLoading,
  dateRange,
  selectedStation,
  insights,
}) => {
  // Fetch variance summary data using the dedicated endpoint
  const { data: varianceSummaryData, isLoading: varianceSummaryLoading } = useVarianceSummary(
    selectedStation && selectedStation !== 'all' ? selectedStation : undefined,
    dateRange?.startDate || '',
    dateRange?.endDate || ''
  );

  // Transform variance summary data into Settlement[] format for VarianceAnalysisChart
  const varianceAsSettlements = useMemo((): Settlement[] => {
    if (!varianceSummaryData?.byDay || varianceSummaryData.byDay.length === 0) {
      return [];
    }

    return varianceSummaryData.byDay.map((day) => ({
      id: `variance-${day.date}`,
      date: day.date,
      stationId: selectedStation || 'all',
      expectedCash: day.expectedCash,
      actualCash: day.expectedCash - day.variance, // variance = expected - actual
      variance: day.variance,
      online: 0,
      credit: 0,
      status: 'final' as const,
      recordedBy: '',
      recordedAt: new Date().toISOString(),
    }));
  }, [varianceSummaryData, selectedStation]);
  
  // Consistent branded color map for fuel types (extend as needed)
  const fuelColorMap: Record<string, string> = {
    petrol: '#3b82f6',
    diesel: '#10b981',
    premium_petrol: '#8b5cf6',
    premium_diesel: '#f97316',
    kerosene: '#ef4444',
  };

  const sortedFuel = (insights?.fuelTypeBreakdown || [])
    .slice()
    .sort((a, b) => (b.sales || 0) - (a.sales || 0));
  return (
    <TabsContent value="overview" className="space-y-4 md:space-y-6">
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
            <div className="space-y-3">
              {sortedFuel.slice(0, 5).map((fuel) => (
                <div key={fuel.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span style={{ background: fuelColorMap[fuel.type] || '#64748b' }} className="w-3 h-3 rounded-full inline-block" />
                    <span className="text-sm text-gray-700 font-medium">{fuel.type.replace('_', ' ')}</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{fuel.percentage.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Variance Analysis Chart - Now using variance summary data */}
      <VarianceAnalysisChart
        settlements={varianceAsSettlements}
        isLoading={varianceSummaryLoading}
        className="w-full"
      />
    </TabsContent>
  );
};
