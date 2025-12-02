

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getFuelBadgeClasses } from '@/lib/fuelColors';

function sourceColor(source: string) {
  if (source === "OCR") return "bg-blue-100 text-blue-700";
  if (source === "Manual") return "bg-orange-100 text-orange-700";
  if (source === "Tender") return "bg-green-100 text-green-700";
  if (source === "Refill") return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-800";
}


export interface Sale {
  id: string | number;
  station_name?: string;
  station_id?: string | number;
  pump_name?: string;
  pump_id?: string | number;
  nozzle_number?: string | number;
  nozzle_id?: string | number;
  total_amount?: number;
  fuel_type?: string;
  source?: string;
  created_at?: string;
}

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
    <div className="w-full overflow-x-auto">
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
            : sales.length > 0 ? sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>{sale.station_name || sale.station_id}</TableCell>
                  <TableCell>{sale.pump_name || sale.pump_id}</TableCell>
                  <TableCell>
                    #{sale.nozzle_number || sale.nozzle_id}
                  </TableCell>
                  <TableCell className="font-semibold text-right">₹{sale.total_amount?.toFixed(2) ?? "NA"}</TableCell>
                  <TableCell>
                    <Badge className={getFuelBadgeClasses(sale.fuel_type)}>
                      {sale.fuel_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={sourceColor(sale.source || "Manual")}>
                      {sale.source || "Manual"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs" title={sale.created_at}>
                      {sale.created_at ? new Date(sale.created_at).toLocaleString() : ""}
                    </span>
                  </TableCell>
                </TableRow>
              ))
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
      {/* Pagination */}
      <div className="flex justify-between items-center mt-3">
        <span className="text-sm text-muted-foreground">
          Page {page} of {numPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 rounded disabled:opacity-50"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Prev
          </button>
          <button
            className="px-2 py-1 rounded disabled:opacity-50"
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
