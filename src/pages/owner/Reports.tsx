/**
 * Owner Reports & Analytics
 * 
 * Refactored to use reusable components from separate files
 * This file now focuses on orchestration and data fetching only
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { useStations } from '@/hooks/api';
import {
  useSalesReports,
  usePumpPerformance,
  useNozzleBreakdown,
  calculateSalesTotals,
  aggregateRawReadingsToSalesReports,
  SalesReport,
} from '@/hooks/useReportData';
import { useToast } from '@/hooks/use-toast';
import {
  ReportHeader,
  FilterBar,
  StatCard,
  DateRange,
} from '@/components/reports';
import {
  printSalesReport,
  printNozzlesReport,
  printPumpsReport,
} from '@/lib/report-export';
import { safeToFixed } from '@/lib/format-utils';
import {
  BarChart3,
  Activity,
  Droplet,
  IndianRupee,
} from 'lucide-react';

// Import tab components
import { ReportTabTriggers } from './reports/ReportTabTriggers';
import { OverviewTab } from './reports/OverviewTab';
import { SalesTab } from './reports/SalesTab';
import { NozzlesTab } from './reports/NozzlesTab';
import { PumpsTab } from './reports/PumpsTab';
import { EmployeesTab } from './reports/EmployeesTab';

// ============================================
// CONSTANTS
// ============================================

const getDefaultDateRange = (): DateRange => {
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .split('T')[0];
  return { startDate: firstDayOfMonth, endDate: today };
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function Reports() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [selectedStation, setSelectedStation] = useState<string>('all');

  // Fetch stations
  const { data: stationsResponse } = useStations();
  const stations = (stationsResponse as any)?.data ?? [];

  // Auto-select station for users with only one station (like managers)
  useEffect(() => {
    if (stations.length === 1 && selectedStation === 'all') {
      setSelectedStation(stations[0].id);
    }
  }, [stations, selectedStation]);

  // Fetch report data using custom hooks
  const { data: salesReports, isLoading: salesLoading } = useSalesReports({
    dateRange,
    selectedStation,
  });
  const { data: pumpPerformance, isLoading: pumpsLoading } = usePumpPerformance({
    dateRange,
    selectedStation,
  });
  const { data: nozzleBreakdown, isLoading: nozzlesLoading } = useNozzleBreakdown({
    dateRange,
    selectedStation,
  });

  // Aggregate raw readings into sales reports if needed
  const aggregatedSalesReports = useMemo(() => {
    if (!salesReports || salesReports.length === 0) return [];
    
    const firstReport = salesReports[0];
    const hasAggregatedFormat = 'totalSales' in firstReport && 'totalQuantity' in firstReport;
    const hasRawFormat = 'totalAmount' in firstReport || 'deltaVolumeL' in firstReport;
    
    if (hasAggregatedFormat) {
      return salesReports;
    }
    
    if (hasRawFormat) {
      return aggregateRawReadingsToSalesReports(salesReports);
    }
    
    return aggregateRawReadingsToSalesReports(salesReports);
  }, [salesReports]);

  // Calculate totals
  const totals = calculateSalesTotals(aggregatedSalesReports);

  // Print handlers
  const handlePrintPdf = (reportType: string) => {
    const onPopupBlocked = () => {
      toast({
        title: 'Popup blocked',
        description: 'Please allow popups to use Print/PDF export.',
      });
    };

    switch (reportType) {
      case 'sales':
        if (aggregatedSalesReports?.length) {
          printSalesReport(aggregatedSalesReports, dateRange, onPopupBlocked);
        }
        break;
      case 'nozzles':
        if (nozzleBreakdown?.length) {
          printNozzlesReport(nozzleBreakdown, dateRange, onPopupBlocked);
        }
        break;
      case 'pumps':
        if (pumpPerformance?.length) {
          printPumpsReport(pumpPerformance, dateRange, onPopupBlocked);
        }
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="container mx-auto p-2 page-container space-y-4">
        {/* Header */}
        <ReportHeader
          title="Reports & Analytics"
          subtitle="Comprehensive insights into your fuel station performance"
          icon={BarChart3}
        />

        {/* Filters */}
        <FilterBar
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          selectedStation={selectedStation}
          onStationChange={setSelectedStation}
          stations={Array.isArray(stations) ? stations : []}
        />

        {/* Key Metrics */}
        <div className="grid gap-2 sm:gap-3 md:gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full">
          <StatCard
            title="Total Revenue"
            value={`₹${totals.sales.toLocaleString('en-IN')}`}
            trend={{ value: 12.5, direction: 'up' }}
            icon={IndianRupee}
          />
          <StatCard
            title="Fuel Dispensed"
            value={`${safeToFixed(totals.quantity, 1)}L`}
            trend={{ value: 8.2, direction: 'up' }}
            icon={Droplet}
          />
          <StatCard
            title="Transactions"
            value={totals.transactions.toString()}
            trend={{ value: 15.3, direction: 'up' }}
            icon={Activity}
          />
        </div>

        {/* Analytics Tabs */}
        <div className="space-y-3">
          <Tabs defaultValue="overview" className="w-full">
            <ReportTabTriggers />

            {/* Tab Contents */}
            <OverviewTab 
              aggregatedSalesReports={aggregatedSalesReports}
              salesLoading={salesLoading}
            />
            <SalesTab
              aggregatedSalesReports={aggregatedSalesReports}
              salesLoading={salesLoading}
              totals={totals}
              onPrintPdf={() => handlePrintPdf('sales')}
            />
            <NozzlesTab
              nozzleBreakdown={nozzleBreakdown}
              nozzlesLoading={nozzlesLoading}
              onPrintPdf={() => handlePrintPdf('nozzles')}
            />
            <PumpsTab
              pumpPerformance={pumpPerformance}
              pumpsLoading={pumpsLoading}
              onPrintPdf={() => handlePrintPdf('pumps')}
            />
            <EmployeesTab
              dateRange={dateRange}
              selectedStation={selectedStation}
            />
          </Tabs>
        </div>
      </div>
    </div>
  );
}
