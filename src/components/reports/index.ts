/**
 * Reports Components Index
 * Central export for all report-related reusable components
 */

// Core components
export { StatCard } from './StatCard';
export type { StatCardProps } from './StatCard';

export { DataCard, DataRow, MetricGrid } from './DataCard';
export type { DataCardProps, DataRowProps, MetricGridProps } from './DataCard';

export { ReportHeader } from './ReportHeader';
export type { ReportHeaderProps, HeaderStat } from './ReportHeader';

export { FilterBar } from './FilterBar';
export type { FilterBarProps, DateRange, StationOption } from './FilterBar';

export { ReportSection } from './ReportSection';
export type { ReportSectionProps } from './ReportSection';

// Report cards
export {
  SalesReportCard,
  NozzleCard,
  ShiftCard,
  PumpCard,
} from './ReportCards';
export type {
  SalesReportCardProps,
  NozzleCardProps,
  ShiftCardProps,
  PumpCardProps,
  SalesReportData,
  NozzleData,
  ShiftData,
  PumpData,
  FuelTypeSale,
  NozzlePerformance,
} from './ReportCards';
