

import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectContent
} from "@/components/ui/select";
import { SlidersHorizontal, Fuel, Droplet, Zap } from "lucide-react";
import type { Pump as PumpType, Nozzle as NozzleType } from '@/types/api';

interface SalesFilterBarProps {
  dateRange: { start: Date | null; end: Date | null };
  onDateRangeChange: (range: { start: Date | null; end: Date | null }) => void;
  productType: string;
  onProductTypeChange: (type: string) => void;
  pumpId: string;
  onPumpIdChange: (id: string) => void;
  nozzleId: string;
  onNozzleIdChange: (id: string) => void;
  pumps: PumpType[];
  nozzles: NozzleType[];
  isMobile?: boolean;
}

export function SalesFilterBar({
  dateRange,
  onDateRangeChange,
  productType,
  onProductTypeChange,
  pumpId,
  onPumpIdChange,
  nozzleId,
  onNozzleIdChange,
  pumps,
  nozzles,
  isMobile = false,
}: SalesFilterBarProps) {
  // The "all" handling is still required for select defaults
  const productTypeValue = productType === "" ? "all" : productType;
  const pumpValue = pumpId === "" ? "all" : pumpId;
  const nozzleValue = nozzleId === "" ? "all" : nozzleId;

  return (
    <div
      className={
        "w-full flex items-center gap-2 px-2 py-3 rounded-lg bg-background/80 shadow-sm border border-border/30" +
        (isMobile ? " flex-col space-y-2" : " flex-row")
      }
    >
      {/* Filter Icon and Date Range */}
      <div className="flex items-center gap-2 min-w-[170px]">
        <Badge variant="secondary" className="px-2 py-1 flex items-center gap-1 shadow-sm">
          <SlidersHorizontal size={16} className="text-muted-foreground" />
          <span className="font-semibold tracking-tight text-xs">Filters</span>
        </Badge>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 min-w-[148px] px-3 py-1 text-left flex-shrink-0 truncate border border-muted-foreground/10"
            >
              {dateRange.start && dateRange.end
                ? `${format(dateRange.start, "dd MMM yyyy")} - ${format(dateRange.end, "dd MMM")}`
                : "Select date range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0 z-50 bg-background">
            <Calendar
              mode="range"
              selected={{
                from: dateRange.start ?? undefined,
                to: dateRange.end ?? undefined,
              }}
              onSelect={(range) => {
                if (!range) {
                  onDateRangeChange({ start: null, end: null });
                } else {
                  onDateRangeChange({
                    start: range.from ?? null,
                    end: range.to ?? null,
                  });
                }
              }}
              className="p-3"
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      {/* Fuel Type Badge/Dropdown */}
      <Select
        value={productTypeValue}
        onValueChange={val => onProductTypeChange(val === "all" ? "" : val)}
      >
        <SelectTrigger
          className={
            "w-auto h-8 bg-muted-foreground/10 hover:bg-muted-foreground/20 rounded-full px-3 min-w-[90px] flex items-center group transition-shadow outline-none border-none shadow-none"
          }
        >
          <Fuel size={15} className="mr-1 text-fuel-orange" />
          <SelectValue
            placeholder="Fuel"
            className="truncate"
          >
            <span className="truncate text-xs font-medium">
              {productTypeValue === "all" ? "All Fuels" : productTypeValue}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Fuels</SelectItem>
          <SelectItem value="Petrol">Petrol</SelectItem>
          <SelectItem value="Diesel">Diesel</SelectItem>
        </SelectContent>
      </Select>

      {/* Pump Badge/Dropdown */}
      <Select
        value={pumpValue}
        onValueChange={val => onPumpIdChange(val === "all" ? "" : val)}
      >
        <SelectTrigger
          className={
            "w-auto h-8 bg-muted-foreground/10 hover:bg-muted-foreground/20 rounded-full px-3 min-w-[85px] flex items-center group transition-shadow outline-none border-none shadow-none"
          }
        >
          <Droplet size={15} className="mr-1 text-blue-600" />
          <SelectValue placeholder="Pump" className="truncate">
            <span className="truncate text-xs font-medium">
              {pumpValue === "all"
                ? "All Pumps"
                : pumps.find(p => p.id?.toString() === pumpValue)?.name?.slice(0, 14) || `Pump ${pumpValue}`}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Pumps</SelectItem>
          {pumps
            .filter(pump => pump && pump.id != null && pump.id !== "")
            .map((pump) => {
              const p = pump as any;
              const pumpLabel = pump.name ?? p.pumpNumber ?? p.pump_sno ?? '';
              return (
                <SelectItem key={pump.id} value={String(pump.id)}>
                  {pumpLabel || `Pump ${pump.id}`}
                </SelectItem>
              );
            })}
        </SelectContent>
      </Select>

      {/* Nozzle Badge/Dropdown */}
      <Select
        value={nozzleValue}
        onValueChange={val => onNozzleIdChange(val === "all" ? "" : val)}
      >
        <SelectTrigger
          className={
            "w-auto h-8 bg-muted-foreground/10 hover:bg-muted-foreground/20 rounded-full px-3 min-w-[100px] flex items-center group transition-shadow outline-none border-none shadow-none"
          }
        >
          <Zap size={13} className="mr-1 text-orange-600" />
          <SelectValue placeholder="Nozzle" className="truncate">
            <span className="truncate text-xs font-medium">
              {nozzleValue === "all"
                ? "All Nozzles"
                : (() => {
                    const found = nozzles.find(n => n.id?.toString() === nozzleValue);
                    if (!found) return nozzleValue;
                    const f = found as any;
                    const num = found.nozzleNumber ?? f.nozzle_number ?? '';
                    const fuel = found.fuelType ?? f.fuel_type ?? '';
                    return `#${num} (${fuel})`;
                  })()}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Nozzles</SelectItem>
          {nozzles
            .filter(nozzle => nozzle && nozzle.id != null && nozzle.id !== "")
            .map((nozzle) => {
              const n = nozzle as any;
              const num = nozzle.nozzleNumber ?? n.nozzle_number ?? '';
              const fuel = nozzle.fuelType ?? n.fuel_type ?? '';
              return (
                <SelectItem key={nozzle.id} value={String(nozzle.id)}>
                  #{num} ({fuel})
                </SelectItem>
              );
            })}
        </SelectContent>
      </Select>
    </div>
  );
}

