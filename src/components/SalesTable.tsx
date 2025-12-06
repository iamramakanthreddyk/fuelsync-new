

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getFuelBadgeClasses } from '@/lib/fuelColors';
import { getSourceBadgeClasses } from '@/lib/constants';
import { safeToFixed } from '@/lib/format-utils';



import type { NozzleReading as Sale } from '@/types/api';

export interface SaleTableProps {
  sales: Sale[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function SalesTable({
  sales,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
}: SaleTableProps) {
  const numPages = Math.ceil(total / pageSize);

  return (
    <div className="w-full">
      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {loading
          ? Array.from({ length: pageSize }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))
          : sales.length > 0 ? sales.map((sale) => {
              const s = sale as any;
              const stationLabel = s.station_name ?? s.stationName ?? s.stationId ?? s.station_id ?? "";
              const pumpLabel = s.pump_name ?? s.pumpName ?? s.pumpId ?? s.pump_id ?? "";
              const nozzleLabel = s.nozzle_number ?? s.nozzleNumber ?? s.nozzleId ?? s.nozzle_id ?? "";
              const totalAmt = (s.totalAmount ?? s.total_amount) as number | undefined;
              const fuelType = s.fuelType ?? s.fuel_type;
              const sourceLabel = s.source ?? s.source_type ?? "Manual";
              const createdAt = s.createdAt ?? s.created_at;

              return (
                <div key={sale.id} className="bg-white rounded-lg border p-3 md:p-4 space-y-3 shadow-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{stationLabel}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        Pump {pumpLabel} • Nozzle #{nozzleLabel}
                      </div>
                    </div>
                    <Badge className={getFuelBadgeClasses(fuelType)} variant="secondary">
                      {fuelType}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-muted-foreground text-xs">Amount</div>
                      <div className="font-semibold truncate">₹{totalAmt != null ? safeToFixed(totalAmt, 2) : "NA"}</div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-muted-foreground text-xs">Volume</div>
                      <div className="font-semibold truncate">{safeToFixed(s.delta_volume_l || 0, 2)} L</div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-muted-foreground gap-2">
                    <Badge variant="outline" className={getSourceBadgeClasses(sourceLabel)}>
                      {sourceLabel}
                    </Badge>
                    <div className="truncate text-right">
                      {createdAt ? new Date(createdAt).toLocaleDateString() : ""}
                    </div>
                  </div>
                </div>
              );
            })
          : (
            <div className="text-center text-muted-foreground py-6">
              No sales data found.
            </div>
          )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Station</TableHead>
              <TableHead>Pump</TableHead>
              <TableHead>Nozzle</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Fuel Type</TableHead>
              <TableHead className="min-w-[90px]">Entry Source</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: pageSize }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  </TableRow>
                ))
              : sales.length > 0 ? sales.map((sale) => {
                  const s = sale as any;
                  const stationLabel = s.station_name ?? s.stationName ?? s.stationId ?? s.station_id ?? "";
                  const pumpLabel = s.pump_name ?? s.pumpName ?? s.pumpId ?? s.pump_id ?? "";
                  const nozzleLabel = s.nozzle_number ?? s.nozzleNumber ?? s.nozzleId ?? s.nozzle_id ?? "";
                  const totalAmt = (s.totalAmount ?? s.total_amount) as number | undefined;
                  const fuelType = s.fuelType ?? s.fuel_type;
                  const sourceLabel = s.source ?? s.source_type ?? "Manual";
                  const createdAt = s.createdAt ?? s.created_at;

                  return (
                    <TableRow key={sale.id}>
                      <TableCell>{stationLabel}</TableCell>
                      <TableCell>{pumpLabel}</TableCell>
                      <TableCell>
                        #{nozzleLabel}
                      </TableCell>
                      <TableCell className="font-semibold text-right">₹{totalAmt != null ? safeToFixed(totalAmt, 2) : "NA"}</TableCell>
                      <TableCell>
                        <Badge className={getFuelBadgeClasses(fuelType)}>
                          {fuelType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSourceBadgeClasses(sourceLabel)}>
                          {sourceLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs" title={createdAt}>
                          {createdAt ? new Date(createdAt).toLocaleString() : ""}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    No sales data found.
                  </TableCell>
                </TableRow>
              )
            }
          </TableBody>
        </Table>
      </div>

      {/* Pagination - Mobile Friendly */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-3 px-2 md:px-0 gap-2">
        <span className="text-sm text-muted-foreground text-center sm:text-left">
          Page {page} of {numPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Prev
          </button>
          <button
            className="px-3 py-1.5 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= numPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
