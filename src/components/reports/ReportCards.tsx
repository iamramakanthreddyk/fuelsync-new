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
  transactions: number;
  avgTransactionValue?: number;
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
  transactions: number;
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
    month: 'long', 
    day: 'numeric' 
  }),
  className,
}) => (
  <Card className={className}>
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-lg">{report.stationName}</CardTitle>
          <CardDescription>{dateFormatter(report.date)}</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">
            ₹{report.totalSales.toLocaleString('en-IN')}
          </div>
          <p className="text-sm text-muted-foreground">
            {safeToFixed(report.totalQuantity)} L
          </p>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {(Array.isArray(report.fuelTypeSales) ? report.fuelTypeSales : []).map(
          (fuel) => (
            <div
              key={`${fuel.fuelType}-${report.stationId}-${report.date}`}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Badge className={getFuelBadgeClasses(fuel.fuelType)}>
                  {fuel.fuelType.toUpperCase()}
                </Badge>
                <div>
                  <div className="font-medium">
                    ₹{fuel.sales.toLocaleString('en-IN')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {safeToFixed(fuel.quantity)} L • {fuel.transactions} transactions
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </CardContent>
  </Card>
);

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
              {nozzle.pumpName && ` - ${nozzle.pumpName}`}
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
            {nozzle.fuelType.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Total Sales</p>
            <p className="text-lg font-bold">
              ₹{totalSales.toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Volume</p>
            <p className="text-lg font-bold">{safeToFixed(totalQuantity)} L</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-lg font-bold">{transactions}</p>
          </div>
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
  <Card className={className}>
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-lg">
            Pump {pump.pumpNumber} - {pump.pumpName}
          </CardTitle>
          <CardDescription>{pump.stationName}</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">
            ₹{pump.totalSales.toLocaleString('en-IN')}
          </div>
          <p className="text-sm text-muted-foreground">
            {safeToFixed(pump.totalQuantity)} L • {pump.transactions} txns
          </p>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <div className="text-sm font-medium mb-2">Nozzles Performance:</div>
        {pump.nozzles.map((nozzle) => (
          <div
            key={nozzle.nozzleId || `${nozzle.nozzleNumber}-${pump.pumpId}`}
            className="flex items-center justify-between p-3 bg-muted rounded-lg"
          >
            <div className="flex items-center gap-3">
              <Badge variant="outline">Nozzle {nozzle.nozzleNumber}</Badge>
              <Badge className={getFuelBadgeClasses(nozzle.fuelType)}>
                {nozzle.fuelType.toUpperCase()}
              </Badge>
            </div>
            <div className="text-right">
              <div className="font-medium">
                ₹{nozzle.sales.toLocaleString('en-IN')}
              </div>
              <div className="text-sm text-muted-foreground">
                {safeToFixed(nozzle.quantity)} L
              </div>
            </div>
          </div>
        ))}
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
