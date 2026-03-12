import React from 'react';
import { ProfitProvider } from '@/context/ProfitProvider';
import { ProfitDashboard } from './ProfitDashboard';

interface DateRange {
  startDate: string;
  endDate: string;
}

export const ProfitDashboardWithProvider = ({ stationId, dateRange }: { stationId: string; dateRange: DateRange }) => {
  return (
    <ProfitProvider stationId={stationId} dateRange={dateRange}>
      <ProfitDashboard dateRange={dateRange} />
    </ProfitProvider>
  );
};
