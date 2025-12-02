import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import { ClipboardCheck, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { useDailySummary } from "@/hooks/useDailySummary";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useAuth } from "@/hooks/useAuth";

import { getDifferenceBadgeClasses } from '@/lib/badgeColors';

export default function DailyClosure() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [closureNotes, setClosureNotes] = useState('');

  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: summary, isLoading } = useDailySummary(selectedDate);
  const { currentStation, isOwner, isAdmin } = useRoleAccess();

  // Close day mutation - uses bank deposit endpoint to record daily closure
  // Note: Backend currently supports handovers/bank-deposit for end-of-day settlements
  const closeDayMutation = useMutation({
    mutationFn: async () => {
      if (!currentStation?.id || !summary) throw new Error('No station or summary data');

      // Record the daily closure as a bank deposit with the day's totals
      // This is a workaround since /daily-closures endpoint doesn't exist
      const depositData = {
        stationId: currentStation.id,
        date: selectedDate,
        amount: summary.breakdown.cash, // Cash to be deposited
        notes: closureNotes || `Daily closure for ${selectedDate}. Sales: ₹${summary.sales_total.toFixed(2)}, Tender: ₹${summary.tender_total.toFixed(2)}, Difference: ₹${summary.difference.toFixed(2)}`
      };

      return await apiClient.post<ApiResponse<unknown>>('/handovers/bank-deposit', depositData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
      toast({
        title: "Success",
        description: "Day closed successfully. Bank deposit recorded.",
      });
      setClosureNotes('');
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to close day",
        variant: "destructive",
      });
    },
  });

  const handleClosureSubmit = () => {
    if (!summary) {
      toast({
        title: "No Data",
        description: "Cannot close day without summary data",
        variant: "destructive",
      });
      return;
    }

    closeDayMutation.mutate();
  };

  const getDifferenceIcon = (difference: number) => {
    if (Math.abs(difference) < 0.01) return <ClipboardCheck className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  if (!currentStation && !isAdmin) {
    return (
      <div className="container mx-auto p-6">
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
      <div className="container mx-auto p-6">
        <div className="text-center">Loading daily summary...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Daily Closure</h1>
        <p className="text-muted-foreground">
          Daily reconciliation and closure {currentStation ? `for ${currentStation.name}` : 'across all stations'}
        </p>
      </div>

      {/* Date selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Date</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div>
              <Label htmlFor="date">Closure Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sales Total</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{summary.sales_total.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">From fuel sales</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tender Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{summary.tender_total.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Cash, Card, UPI</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Difference</CardTitle>
                {getDifferenceIcon(summary.difference)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{summary.difference.toFixed(2)}</div>
                <Badge className={getDifferenceBadgeClasses(summary.difference)}>
                  {Math.abs(summary.difference) < 0.01 ? 'Balanced' : 
                   summary.difference > 0 ? 'Over' : 'Short'}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {Math.abs(summary.difference) < 0.01 ? 'Ready' : 'Check Required'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {Math.abs(summary.difference) < 0.01 ? 'Can close' : 'Reconcile first'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tender breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Tender Breakdown</CardTitle>
              <CardDescription>
                Payment method breakdown for {new Date(selectedDate).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Cash</p>
                  <p className="text-xl font-bold">₹{summary.breakdown.cash.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Card</p>
                  <p className="text-xl font-bold">₹{summary.breakdown.card.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">UPI</p>
                  <p className="text-xl font-bold">₹{summary.breakdown.upi.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Credit</p>
                  <p className="text-xl font-bold">₹{summary.breakdown.credit.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Closure actions */}
          {(isOwner || isAdmin) && (
            <Card>
              <CardHeader>
                <CardTitle>Day Closure</CardTitle>
                <CardDescription>
                  Finalize the day's transactions and close the books
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="notes">Closure Notes (Optional)</Label>
                  <Input
                    id="notes"
                    value={closureNotes}
                    onChange={(e) => setClosureNotes(e.target.value)}
                    placeholder="Any notes about the day's operations..."
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Ready to close day?</p>
                    <p className="text-sm text-muted-foreground">
                      This will finalize all transactions for {new Date(selectedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Button 
                    onClick={handleClosureSubmit}
                    disabled={closeDayMutation.isPending}
                    variant={Math.abs(summary.difference) < 0.01 ? "default" : "destructive"}
                  >
                    {closeDayMutation.isPending ? 'Closing...' : 'Close Day'}
                  </Button>
                </div>

                {Math.abs(summary.difference) >= 0.01 && (
                  <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <p className="text-sm font-medium text-yellow-600">
                        Warning: Sales and tender totals don't match
                      </p>
                    </div>
                    <p className="text-sm text-yellow-600 mt-1">
                      Please verify all transactions before closing the day.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!summary && (
        <Card>
          <CardContent className="pt-6 text-center">
            <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No data available</h3>
            <p className="text-muted-foreground">
              No sales or tender data found for {new Date(selectedDate).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
