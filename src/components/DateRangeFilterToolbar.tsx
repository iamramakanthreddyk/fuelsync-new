import { useGlobalFilter } from '@/context/GlobalFilterContext';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';

export function DateRangeFilterToolbar() {
  const { startDate, endDate, setDateRange } = useGlobalFilter();

  return (
    <div className="w-full bg-white border-b border-slate-200/60 shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-4">
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
