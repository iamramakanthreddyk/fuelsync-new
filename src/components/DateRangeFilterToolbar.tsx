import { useGlobalFilter } from '@/context/GlobalFilterContext';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';

export function DateRangeFilterToolbar() {
  const { startDate, endDate, setDateRange } = useGlobalFilter();

  return (
    <div className="sticky top-12 z-40 bg-white border-b border-slate-200/60 shadow-sm">
      <div className="w-full px-3 md:px-6 lg:px-8 xl:px-12 py-3">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={setDateRange}
          showPresets={true}
          label="Global Date Filter"
          className="space-y-2"
        />
      </div>
    </div>
  );
}
