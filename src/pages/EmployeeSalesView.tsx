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

export default function EmployeeSalesView() {
  const [isToday] = useState(true);

  const { currentStation } = useRoleAccess();
  const { data: sales, isLoading } = useSalesData(isToday ? new Date().toISOString().split('T')[0] : undefined);
  const { data: pumps } = usePumpsData();

  // FILTERS - controlled by filter bar
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: new Date(),
    end: new Date(),
  });
  const [productType, setProductType] = useState<string>("");
  const [pumpId, setPumpId] = useState<string>("all");
  const [nozzleId, setNozzleId] = useState<string>("all");

  // Filter logic using actual Sale structure with fuel_type directly available
  const filteredSales = sales?.filter(sale => {
    // Date filter - use reading_date (YYYY-MM-DD string) for comparison
    if (dateRange.start && dateRange.end && sale.reading_date) {
      const saleDate = new Date(sale.reading_date);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);

      // Normalize to compare only dates (not times)
      saleDate.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      if (saleDate < startDate || saleDate > endDate) {
        return false;
      }
    }

    // Product type (fuel) - fuel_type is directly on sale object
    if (productType && sale.fuel_type?.toUpperCase() !== productType.toUpperCase()) {
      return false;
    }

    // Station filter (if still using old number-based filter)
    // Note: Employees typically only see their assigned station data
    // if (selectedStationId && sale.station_id !== selectedStationId.toString()) {
    //   return false;
    // }

    return true;
  }) || [];

  // Calculate summary values
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
  const totalVolume = filteredSales.reduce((sum, sale) => sum + (sale.delta_volume_l || 0), 0);
  const transactionCount = filteredSales.length;

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pagedSales = filteredSales.slice((page - 1) * pageSize, page * pageSize);

  if (isLoading) {
    return (
      <div className="w-full flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6">
          <div className="space-y-1">
            <div className="h-8 md:h-10 lg:h-12 bg-muted animate-pulse rounded w-64"></div>
            <div className="h-4 md:h-5 bg-muted animate-pulse rounded w-96"></div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-12 bg-muted animate-pulse rounded"></div>
          <div className="h-80 bg-muted animate-pulse rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">Sales Overview</h1>
          <p className="text-sm md:text-base lg:text-lg text-muted-foreground">
            View sales data {currentStation ? `for ${currentStation.name}` : 'across all stations'}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
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
        isMobile={false}
      />

      {/* Summary Cards */}
      <SalesSummaryCards
        totalRevenue={totalRevenue}
        totalVolume={totalVolume}
        transactionCount={transactionCount}
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="bg-background rounded-lg shadow-sm p-2">
            <SalesCharts salesData={filteredSales as any} isLoading={isLoading} />
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <div className="bg-background rounded-lg shadow-sm p-2">
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