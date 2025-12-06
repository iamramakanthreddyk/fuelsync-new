
import React from "react";
import { cn } from "@/lib/utils";

interface SalesSummaryCardsProps {
  totalRevenue: number;
  totalVolume: number;
  transactionCount: number;
}

export function SalesSummaryCards({
  totalRevenue,
  totalVolume,
  transactionCount,
}: SalesSummaryCardsProps) {
  // Format large numbers to prevent overflow
  const formatRevenue = (value: number) => {
    if (value >= 10000000) { // 1 crore
      return `₹${(value / 10000000).toFixed(1)}Cr`;
    } else if (value >= 100000) { // 1 lakh
      return `₹${(value / 100000).toFixed(1)}L`;
    } else if (value >= 1000) { // 1 thousand
      return `₹${(value / 1000).toFixed(1)}K`;
    }
    return `₹${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  const formatVolume = (value: number) => {
    if (value >= 1000000) { // 1 million liters
      return `${(value / 1000000).toFixed(1)}M L`;
    } else if (value >= 1000) { // 1 thousand liters
      return `${(value / 1000).toFixed(1)}K L`;
    }
    return `${value.toLocaleString(undefined, { minimumFractionDigits: 2 })} L`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
      {/* Total Revenue Card */}
      <div className="flex flex-col gap-2 rounded-xl p-3 md:p-4 lg:p-5 shadow-sm bg-gradient-to-r from-blue-50/90 via-blue-100/80 to-blue-300/30 border border-blue-100 min-h-[90px] md:min-h-[110px] lg:min-h-[124px]">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="rounded-full bg-blue-500 p-1 md:p-1.5 lg:p-2 text-white shadow flex-shrink-0">
            <svg width="16" height="16" className="md:w-5 md:h-5 lg:w-6 lg:h-6"><use href="#lucide-indian-rupee"/></svg>
          </span>
          <span className="text-xs md:text-sm font-semibold text-blue-900 uppercase tracking-wide truncate">Total Revenue</span>
        </div>
        <div className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-blue-900 tracking-tight break-all md:break-normal overflow-hidden">
          {formatRevenue(totalRevenue)}
        </div>
        <div className="text-xs md:text-sm text-blue-700 truncate">All Pumps · All Time</div>
      </div>

      {/* Total Volume Card */}
      <div className="flex flex-col gap-2 rounded-xl p-3 md:p-4 lg:p-5 shadow-sm bg-gradient-to-r from-green-50/70 via-green-100/80 to-green-300/30 border border-green-100 min-h-[90px] md:min-h-[110px] lg:min-h-[124px]">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="rounded-full bg-green-500 p-1 md:p-1.5 lg:p-2 text-white shadow flex-shrink-0">
            <svg width="14" height="14" className="md:w-4 md:h-4 lg:w-5 lg:h-5"><use href="#lucide-droplet"/></svg>
          </span>
          <span className="text-xs md:text-sm font-semibold text-green-900 uppercase tracking-wide truncate">Total Volume</span>
        </div>
        <div className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-green-900 tracking-tight break-all md:break-normal overflow-hidden">
          {formatVolume(totalVolume)}
        </div>
        <div className="text-xs md:text-sm text-green-700 truncate">Litres · This Range</div>
      </div>

      {/* Transactions Card */}
      <div className="flex flex-col gap-2 rounded-xl p-3 md:p-4 lg:p-5 shadow-sm bg-gradient-to-r from-orange-100/80 via-orange-200/80 to-yellow-200/30 border border-orange-100 min-h-[90px] md:min-h-[110px] lg:min-h-[124px] sm:col-span-2 lg:col-span-1">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="rounded-full bg-orange-500 p-1 md:p-1.5 lg:p-2 text-white shadow flex-shrink-0">
            <svg width="14" height="14" className="md:w-4 md:h-4 lg:w-5 lg:h-5"><use href="#lucide-list"/></svg>
          </span>
          <span className="text-xs md:text-sm font-semibold text-orange-900 uppercase tracking-wide truncate">Transactions</span>
        </div>
        <div className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-orange-900 tracking-tight">
          {transactionCount.toLocaleString()}
        </div>
        <div className="text-xs md:text-sm text-orange-700 truncate">Sale Entries</div>
      </div>
    </div>
  );
}
