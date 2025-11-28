
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      <div className="flex flex-col gap-2 rounded-xl p-5 shadow-sm bg-gradient-to-r from-blue-50/90 via-blue-100/80 to-blue-300/30 border border-blue-100 min-h-[124px]">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-500 p-2 text-white shadow">
            <svg width="24" height="24"><use href="#lucide-indian-rupee"/></svg>
          </span>
          <span className="text-xs md:text-sm font-semibold text-blue-900 uppercase tracking-wide">Total Revenue</span>
        </div>
        <div className="text-2xl md:text-3xl font-bold text-blue-900 tracking-tight">
          ₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
        <div className="text-xs md:text-sm text-blue-700">All Pumps · All Time</div>
      </div>
      <div className="flex flex-col gap-2 rounded-xl p-5 shadow-sm bg-gradient-to-r from-green-50/70 via-green-100/80 to-green-300/30 border border-green-100 min-h-[124px]">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-green-500 p-2 text-white shadow">
            <svg width="22" height="22"><use href="#lucide-droplet"/></svg>
          </span>
          <span className="text-xs md:text-sm font-semibold text-green-900 uppercase tracking-wide">Total Volume</span>
        </div>
        <div className="text-2xl md:text-3xl font-bold text-green-900 tracking-tight">
          {totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })} L
        </div>
        <div className="text-xs md:text-sm text-green-700">Litres · This Range</div>
      </div>
      <div className="flex flex-col gap-2 rounded-xl p-5 shadow-sm bg-gradient-to-r from-orange-100/80 via-orange-200/80 to-yellow-200/30 border border-orange-100 min-h-[124px]">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-orange-500 p-2 text-white shadow">
            <svg width="21" height="21"><use href="#lucide-list"/></svg>
          </span>
          <span className="text-xs md:text-sm font-semibold text-orange-900 uppercase tracking-wide">Transactions</span>
        </div>
        <div className="text-2xl md:text-3xl font-bold text-orange-900 tracking-tight">
          {transactionCount}
        </div>
        <div className="text-xs md:text-sm text-orange-700">Sale Entries</div>
      </div>
    </div>
  );
}
