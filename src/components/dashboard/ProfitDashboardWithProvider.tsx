import React from 'react';
import { ProfitProvider } from '@/context/ProfitProvider';
import { ProfitDashboard } from './ProfitDashboard';

export const ProfitDashboardWithProvider = ({ stationId }: { stationId: string }) => {
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  return (
    <ProfitProvider stationId={stationId} month={selectedMonth}>
      <ProfitDashboard selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />
    </ProfitProvider>
  );
};
