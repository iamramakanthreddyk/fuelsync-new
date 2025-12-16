import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import { ClipboardCheck } from "lucide-react";
import { useDailySummary } from "@/hooks/useDailySummary";
import { useRoleAccess } from "@/hooks/useRoleAccess";

// formatting and badge helper imports removed (not used in this simplified view)

export default function Settlements() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [closureNotes, setClosureNotes] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: summary, isLoading } = useDailySummary(selectedDate);
  const { currentStation, isOwner, isAdmin } = useRoleAccess();

  // Close day mutation - records daily closure and settlement
  const closeDayMutation = useMutation({
    mutationFn: async () => {
      if (!currentStation?.id || !summary) throw new Error('No station or summary data');

      const settlementData = {
        stationId: currentStation.id,
        date: selectedDate,
        totalSales: summary.sales_total,
        // Use transaction-level payment breakdown
        expectedCash: summary.breakdown.cash,
        cardAmount: summary.breakdown.card,
        upiAmount: summary.breakdown.upi,
        creditAmount: summary.breakdown.credit,
        notes: closureNotes || `Daily closure for ${selectedDate}`
      };

      return await apiClient.post<ApiResponse<unknown>>('/settlements/daily-close', settlementData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      toast({
        title: "Success",
        description: "Day closed successfully. Settlement recorded.",
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

  // closure submit helper
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
        <h1 className="text-3xl font-bold">Settlements (Daily Closure)</h1>
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
          <Card>
            <CardHeader>
              <CardTitle>Daily Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p>Total Sales: {summary.sales_total}</p>
                <p>Breakdown — Cash: {summary.breakdown.cash}, Card: {summary.breakdown.card}, UPI: {summary.breakdown.upi}, Credit: {summary.breakdown.credit}</p>
                {isOwner && (
                  <div className="flex gap-2">
                    <Input
                      id="closureNotes"
                      value={closureNotes}
                      onChange={(e) => setClosureNotes(e.target.value)}
                      placeholder="Optional notes for this closure"
                    />
                    <Button onClick={handleClosureSubmit}>Close Day</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!summary && (
        <Card>
          <CardContent className="pt-6 text-center">
            <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No data available</h3>
            <p className="text-muted-foreground">
              No sales or payment data found for {new Date(selectedDate).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
