import { useGlobalFilter } from '@/context/GlobalFilterContext';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';

export function DateRangeFilterToolbar() {
  const { startDate, endDate, setDateRange } = useGlobalFilter();

  return (
    <div className="bg-white border-b border-slate-200/60 shadow-sm rounded-lg -mx-4 -mt-4 px-4 mb-4 py-3 sm:-mx-6 sm:-mt-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-12 xl:px-12">
      <div className="w-full">
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
