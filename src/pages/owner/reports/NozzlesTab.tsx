import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { ReportSection, NozzleCard } from '@/components/reports';
import { Droplet } from 'lucide-react';

interface NozzlesTabProps {
  nozzleBreakdown: any[] | undefined;
  nozzlesLoading: boolean;
  onPrintPdf: () => void;
}

export const NozzlesTab: React.FC<NozzlesTabProps> = ({
  nozzleBreakdown,
  nozzlesLoading,
  onPrintPdf,
}) => {
  return (
    <TabsContent value="nozzles" className="space-y-2">
      <ReportSection
        title="Nozzle Sales"
        description="Performance by nozzle"
        isLoading={nozzlesLoading}
        loadingText="Loading nozzle data..."
        isEmpty={!nozzleBreakdown || nozzleBreakdown.length === 0}
        emptyState={{
          icon: Droplet,
          title: 'No Nozzle Data',
          description: 'No nozzle sales data found for the selected period',
        }}
        onPrintPdf={onPrintPdf}
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(nozzleBreakdown ?? []).map((nozzle: any) => (
            <NozzleCard key={nozzle.nozzleId} nozzle={nozzle} />
          ))}
        </div>
      </ReportSection>
    </TabsContent>
  );
};
