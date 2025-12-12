
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { TrendingUp, IndianRupee, Clock, AlertTriangle } from "lucide-react";
import React from "react";
import { safeToFixed } from '@/lib/format-utils';

interface KeyMetricsCardsProps {
  todaySales: number;
  todayPayments: number;
  pendingClosures: number;
  premiumRequired: boolean;
  variance: number;
  lockWidgetProps: React.HTMLAttributes<HTMLDivElement>;
  lockOverlay: React.ReactNode;
}

export function KeyMetricsCards({
  todaySales,
  todayPayments,
  pendingClosures,
  premiumRequired,
  variance,
  lockWidgetProps,
  lockOverlay,
}: KeyMetricsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Sales Today */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Sales Today</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">₹{safeToFixed(todaySales, 2)}</div>
          <p className="text-xs text-muted-foreground">
            From fuel dispensing
          </p>
        </CardContent>
      </Card>
      {/* Total Tender */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tender</CardTitle>
          <IndianRupee className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">₹{safeToFixed(todayPayments, 2)}</div>
          <p className="text-xs text-muted-foreground">
            Cash, card, UPI & credit
          </p>
        </CardContent>
      </Card>
      {/* Pending Closures */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Closures</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${pendingClosures > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {pendingClosures}
          </div>
          <p className="text-xs text-muted-foreground">
            {pendingClosures > 0 ? 'Need attention' : 'All closed'}
          </p>
        </CardContent>
      </Card>
      {/* Daily Variance (Premium ONLY) */}
      <div className="relative">
        <Card className={`hover:shadow-md transition-shadow ${premiumRequired ? 'pointer-events-auto opacity-60 blur-sm' : ''}`}
          {...(premiumRequired ? lockWidgetProps : {})}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Variance</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${Math.abs(variance) < 1 ? 'text-green-600' : variance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {Math.abs(variance) < 1 ? 'Balanced' : `${variance > 0 ? '+' : '-'}₹${safeToFixed(Math.abs(variance), 2)}`}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.abs(variance) < 1 ? 'Sales match collections' : variance > 0 ? 'Collection excess' : 'Collection shortage'}
            </p>
          </CardContent>
          {/* Add overlay only if locked */}
          {premiumRequired && lockOverlay}
        </Card>
      </div>
    </div>
  );
}
