import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { useSalesData } from "@/hooks/useSalesData";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { usePumpsData } from "@/hooks/usePumpsData";
import { SalesCharts } from "@/components/SalesCharts";
import { SalesFilterBar } from "@/components/SalesFilterBar";
import { SalesTable } from "@/components/SalesTable";
import { SalesSummaryCards } from "@/components/SalesSummaryCards";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";

export default function EmployeeSalesView() {
  const [isToday] = useState(true);
  const isMobile = useIsMobile();

  const { currentStation } = useRoleAccess();
  const { data: sales, isLoading } = useSalesData(isToday ? new Date().toISOString().split('T')[0] : undefined);
  const { data: pumps } = usePumpsData();

  // FILTERS - controlled by filter bar
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: new Date(new Date().toDateString()), // Start of today
    end: new Date(new Date().toDateString()), // End of today
  });
  const [productType, setProductType] = useState<string>("");
  const [pumpId, setPumpId] = useState<string>("all");
  const [nozzleId, setNozzleId] = useState<string>("all");

  // Filter logic - Server already filters by today's date
  const filteredSales = sales?.filter(sale => {
    // Product type (fuel) filter
    if (productType && sale.fuelType?.toUpperCase() !== productType.toUpperCase()) {
      return false;
    }

    // Pump filter
    if (pumpId && pumpId !== "all" && sale.pumpId !== pumpId) {
      return false;
    }

    // Nozzle filter
    if (nozzleId && nozzleId !== "all" && sale.nozzleId !== nozzleId) {
      return false;
    }

    return true;
  }) || [];

  // Calculate summary values
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const totalVolume = filteredSales.reduce((sum, sale) => sum + (sale.deltaVolumeL || 0), 0);
  const transactionCount = filteredSales.length;


  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pagedSales = filteredSales.slice((page - 1) * pageSize, page * pageSize);

  if (isLoading) {
    return (
      <div className="w-full flex flex-col gap-4 md:gap-6 px-1 sm:px-2 md:px-0">
        <div className="flex flex-col justify-between items-start gap-2 md:gap-4">
          <div className="space-y-1">
            <div className="h-6 md:h-8 lg:h-10 bg-muted animate-pulse rounded w-36 sm:w-48 md:w-64"></div>
            <div className="h-3 md:h-4 bg-muted animate-pulse rounded w-40 sm:w-64 md:w-96"></div>
          </div>
        </div>
        <div className="space-y-3 md:space-y-6">
          <div className="h-10 md:h-12 bg-muted animate-pulse rounded"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 md:h-20 bg-muted animate-pulse rounded-lg"></div>
            ))}
          </div>
          <div className="h-48 sm:h-64 md:h-80 bg-muted animate-pulse rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3 md:gap-6 px-1 sm:px-2 md:px-0">
      <div className="flex flex-col justify-between items-start gap-2 md:gap-4">
        <div className="space-y-1">
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold tracking-tight">Sales Overview</h1>
          <p className="text-xs sm:text-sm lg:text-base text-muted-foreground">
            View sales data {currentStation ? `for ${currentStation.name}` : 'across all stations'}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="w-full">
        <SalesFilterBar
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          productType={productType}
          onProductTypeChange={setProductType}
          pumpId={pumpId}
          onPumpIdChange={setPumpId}
          nozzleId={nozzleId}
          onNozzleIdChange={setNozzleId}
          pumps={pumps || []}
          nozzles={[]}
          isMobile={isMobile}
          showDateFilter={false} // Employees see today's data only
        />
      </div>

      {/* Summary Cards */}
      <div className="w-full">
        <SalesSummaryCards
          totalRevenue={totalRevenue}
          totalVolume={totalVolume}
          transactionCount={transactionCount}
        />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2 h-10' : 'grid-cols-2'}`}>
          <TabsTrigger value="overview" className={isMobile ? 'text-xs px-2' : ''}>Overview</TabsTrigger>
          <TabsTrigger value="transactions" className={isMobile ? 'text-xs px-2' : ''}>Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-2 md:space-y-4 mt-2 md:mt-6">
          <div className="bg-background rounded-lg shadow-sm p-1 sm:p-2 md:p-4 w-full overflow-x-auto">
            <div className="min-w-[320px] sm:min-w-0">
              <SalesCharts salesData={filteredSales as any} isLoading={isLoading} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-2 md:space-y-4 mt-2 md:mt-6">
          <div className="bg-background rounded-lg shadow-sm p-1 sm:p-2 md:p-4">
            <SalesTable
              sales={pagedSales as any}
              loading={isLoading}
              page={page}
              pageSize={pageSize}
              total={filteredSales.length}
              onPageChange={setPage}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}