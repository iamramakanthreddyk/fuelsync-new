import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { ReportSection, PumpCard } from '@/components/reports';
import { Activity } from 'lucide-react';

interface PumpsTabProps {
  pumpPerformance: any[] | undefined;
  pumpsLoading: boolean;
  onPrintPdf: () => void;
}

export const PumpsTab: React.FC<PumpsTabProps> = ({
  pumpPerformance,
  pumpsLoading,
  onPrintPdf,
}) => {
  return (
    <TabsContent value="pumps" className="space-y-4">
      <ReportSection
        title="Pumps"
        description="Performance by pump & nozzle"
        isLoading={pumpsLoading}
        loadingText="Loading pump performance..."
        isEmpty={!pumpPerformance || pumpPerformance.length === 0}
        emptyState={{
          icon: Activity,
          title: 'No Pump Data',
          description: 'No pump performance data found for the selected filters',
        }}
        onPrintPdf={onPrintPdf}
      >
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {(pumpPerformance ?? []).map((pump: any) => (
            <PumpCard
              key={pump.pumpId || `${pump.pumpName}-${pump.pumpNumber}`}
              pump={pump}
              className="h-fit"
            />
          ))}
        </div>
      </ReportSection>
    </TabsContent>
  );
};
