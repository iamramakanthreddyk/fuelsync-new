import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Filter,
  Download,
  Fuel,
  DollarSign,
  BarChart3
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useSalesData } from "@/hooks/useSalesData";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { getFuelColors } from '@/lib/fuelColors';

export default function Sales() {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Filters
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: new Date(),
    end: new Date(),
  });
  const [productType, setProductType] = useState<string>("");
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);

  const { toast } = useToast();
  const { data: sales, isLoading } = useSalesData(dateRange.start ? new Date(dateRange.start).toISOString().split('T')[0] : undefined);
  const { currentStation, canAccessAllStations, stations, isManager } = useRoleAccess();

  

  if (!currentStation && !canAccessAllStations && !isManager) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-7xl ml-4 lg:ml-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No station assigned to your account. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-7xl ml-4 lg:ml-6">
        <Skeleton className="h-12 w-full mb-4" />
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Management</h1>
          <p className="text-muted-foreground">
            Track and manage fuel sales {currentStation ? `for ${currentStation.name}` : 'across all stations'}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${sales?.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sales?.reduce((sum, sale) => sum + (sale.deltaVolumeL || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) || '0.0'} L
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sales?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </div>
            <Badge variant="secondary">{Object.values({ productType, selectedStationId }).filter(Boolean).length} active</Badge>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Date Range</Label>
              {/* Date range picker would go here */}
              <div className="text-sm text-muted-foreground">Today</div>
            </div>

            <div>
              <Label>Fuel Type</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger>
                  <SelectValue placeholder="All fuels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All fuels</SelectItem>
                  <SelectItem value="PETROL">Petrol</SelectItem>
                  <SelectItem value="DIESEL">Diesel</SelectItem>
                  <SelectItem value="CNG">CNG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Station</Label>
              <Select value={selectedStationId?.toString() || ""} onValueChange={(value) => setSelectedStationId(value ? parseInt(value) : null)}>
                <SelectTrigger>
                  <SelectValue placeholder="All stations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All stations</SelectItem>
                  {stations?.map(station => (
                    <SelectItem key={station.id} value={station.id.toString()}>
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Sales Transactions</CardTitle>
              <CardDescription>Recent fuel sales and transactions</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : sales && sales.length > 0 ? (
            <div className="space-y-4">
              {sales
                .filter(sale => {
                  if (productType && sale.fuelType?.toUpperCase() !== productType.toUpperCase()) return false;
                  if (selectedStationId && sale.stationId !== selectedStationId.toString()) return false;
                  return true;
                })
                .map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${getFuelColors(sale.fuelType).dot}`} />
                      <div>
                        <div className="font-medium">{sale.fuelType?.toUpperCase()}</div>
                        <div className="text-sm text-muted-foreground">
                          {sale.pumpName || `Pump ${sale.pumpId}`} • Nozzle {sale.nozzleNumber || sale.nozzleId}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${(sale.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="text-sm text-muted-foreground">{(sale.deltaVolumeL || 0).toFixed(1)} L</div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No sales data available for the selected filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
