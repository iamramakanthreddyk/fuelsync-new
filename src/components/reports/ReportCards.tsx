/**
 * Report Section Cards
 * 
 * Reusable card components for displaying various report data:
 * - SalesReportCard
 * - NozzleCard
 * - ShiftCard
 * - PumpCard
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { safeToFixed } from '@/lib/format-utils';
import { getFuelBadgeClasses } from '@/lib/fuelColors';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export interface FuelTypeSale {
  fuelType: string;
  sales: number;
  quantity: number;
  transactions: number;
}

export interface SalesReportData {
  stationId: string;
  stationName: string;
  date: string;
  totalSales: number;
  totalQuantity: number;
  totalTransactions: number;
  fuelTypeSales?: FuelTypeSale[];
}

export interface NozzleData {
  nozzleId: string;
  nozzleNumber: string | number;
  fuelType: string;
  pumpName?: string;
  stationName?: string;
  totalSales: number;
  totalQuantity: number;
  transactions?: number;
}

export interface ShiftData {
  id: number;
  stationName: string;
  employeeName: string;
  startTime: string;
  endTime?: string;
  openingCash: number;
  closingCash?: number;
  totalSales: number;
  cashSales?: number;
  digitalSales: number;
  status: 'active' | 'completed' | 'cancelled';
}

export interface NozzlePerformance {
  nozzleId?: string;
  nozzleNumber: string | number;
  fuelType: string;
  sales: number;
  quantity: number;
}

export interface PumpData {
  pumpId: string;
  pumpName: string;
  pumpNumber: string | number;
  stationName: string;
  totalSales: number;
  totalQuantity: number;
  transactions?: number;
  nozzles: NozzlePerformance[];
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getBadgeVariant = (status: string): 'default' | 'secondary' | 'outline' => {
  if (status === 'completed') return 'default';
  if (status === 'active') return 'secondary';
  return 'outline';
};

// ============================================
// SALES REPORT CARD
// ============================================

export interface SalesReportCardProps {
  report: SalesReportData;
  dateFormatter?: (date: string) => string;
  className?: string;
}

export const SalesReportCard: React.FC<SalesReportCardProps> = ({
  report,
  dateFormatter = (date) => new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }),
  className,
}) => {
  // Compact fuel item for listings (horizontal, minimal)
  const FuelItem: React.FC<{ fuel: FuelTypeSale }> = ({ fuel }) => (
    <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-gray-50 border border-gray-100 text-xs">
      <Badge className={`${getFuelBadgeClasses(fuel.fuelType)} text-[10px] px-1 py-0.5 shrink-0`}>{(fuel.fuelType || 'UNK').toUpperCase()}</Badge>
      <span className="font-semibold text-gray-700 truncate">₹{fuel.sales.toLocaleString('en-IN')}</span>
      <span className="text-gray-500">{safeToFixed(fuel.quantity)} L</span>
      <span className="text-gray-400">{fuel.transactions} txns</span>
    </div>
  );

  return (
    <Card className={cn('w-full border border-gray-100 shadow-sm bg-white', className)}>
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-800 truncate text-xs">{report.stationName}</div>
          <div className="text-[11px] text-gray-400">{dateFormatter(report.date)}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <span className="text-green-600 font-bold">₹{report.totalSales.toLocaleString('en-IN')}</span>
          <span className="text-blue-600 font-medium">{safeToFixed(report.totalQuantity)} L</span>
          <span className="text-purple-600">{report.totalTransactions} txns</span>
        </div>
      </div>
      {Array.isArray(report.fuelTypeSales) && report.fuelTypeSales.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          {report.fuelTypeSales.map((fuel) => (
            <FuelItem key={`${fuel.fuelType}-${report.stationId}-${report.date}`} fuel={fuel} />
          ))}
        </div>
      )}
    </Card>
  );
};

// ============================================
// NOZZLE CARD
// ============================================

export interface NozzleCardProps {
  nozzle: NozzleData;
  className?: string;
}

export const NozzleCard: React.FC<NozzleCardProps> = ({ nozzle, className }) => {
  const totalSales = nozzle?.totalSales ?? 0;
  const totalQuantity = nozzle?.totalQuantity ?? 0;
  const transactions = nozzle?.transactions ?? 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">
              Nozzle {nozzle.nozzleNumber}
              {nozzle.pumpName && ` - Dispenser ${nozzle.pumpName}`}
            </CardTitle>
            {nozzle.stationName && (
              <CardDescription className="text-xs">
                {nozzle.stationName}
              </CardDescription>
            )}
          </div>
          <Badge
            className={getFuelBadgeClasses(nozzle.fuelType)}
            variant="outline"
          >
            {(nozzle.fuelType || 'UNKNOWN').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2 bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
          <span className="text-[10px] text-blue-600 font-bold uppercase">Sales</span>
          <span className="text-lg font-bold text-blue-700">
            ₹{totalSales.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
          <span className="text-[10px] text-green-600 font-bold uppercase">Volume</span>
          <span className="text-lg font-bold text-green-700">{safeToFixed(totalQuantity)} L</span>
        </div>
        <div className="flex items-center justify-between gap-2 bg-purple-50 rounded-lg p-3 border-l-4 border-purple-500">
          <span className="text-[10px] text-purple-600 font-bold uppercase">Trans.</span>
          <span className="text-lg font-bold text-purple-700">{transactions}</span>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// SHIFT CARD
// ============================================

export interface ShiftCardProps {
  shift: ShiftData;
  className?: string;
}

export const ShiftCard: React.FC<ShiftCardProps> = ({ shift, className }) => (
  <Card className={className}>
    <CardContent className="pt-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{shift.employeeName}</span>
            <Badge variant={getBadgeVariant(shift.status)}>{shift.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>{shift.stationName}</div>
            <div>
              {shift.startTime} - {shift.endTime || 'In Progress'}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-muted-foreground">Opening Cash</div>
            <div className="font-medium">
              ₹{shift.openingCash.toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Closing Cash</div>
            <div className="font-medium">
              {shift.closingCash
                ? `₹${shift.closingCash.toLocaleString('en-IN')}`
                : '-'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Total Sales</div>
            <div className="font-medium">
              ₹{shift.totalSales.toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Digital Sales</div>
            <div className="font-medium">
              ₹{shift.digitalSales.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

// ============================================
// PUMP CARD
// ============================================

export interface PumpCardProps {
  pump: PumpData;
  className?: string;
}

export const PumpCard: React.FC<PumpCardProps> = ({ pump, className }) => (
  <Card className={cn("w-full", className)}>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base md:text-lg truncate">
            Fuel Dispenser {pump.pumpNumber} - {pump.pumpName}
          </CardTitle>
          <CardDescription className="text-xs md:text-sm truncate">{pump.stationName}</CardDescription>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg md:text-xl font-bold text-green-600">
            ₹{pump.totalSales.toLocaleString('en-IN')}
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
            {safeToFixed(pump.totalQuantity)} L
          </p>
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-2">Nozzles ({pump.nozzles?.length || 0})</div>
        <div className="space-y-2">
          {pump.nozzles.map((nozzle) => (
            <div
              key={nozzle.nozzleId || `${nozzle.nozzleNumber}-${pump.pumpId}`}
              className="flex items-center justify-between p-2.5 bg-muted/40 rounded border text-sm"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Badge variant="outline" className="text-xs px-1.5 py-0.5 shrink-0 font-semibold">
                  Nozzle {nozzle.nozzleNumber}
                </Badge>
                <Badge className={`${getFuelBadgeClasses(nozzle.fuelType)} text-xs px-1.5 py-0.5 shrink-0`}>
                  {nozzle.fuelType}
                </Badge>
              </div>
              <div className="text-right ml-2 shrink-0">
                <div className="font-semibold text-green-600">
                  ₹{nozzle.sales.toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {safeToFixed(nozzle.quantity)} L
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardContent>
  </Card>
);

export default {
  SalesReportCard,
  NozzleCard,
  ShiftCard,
  PumpCard,
};
