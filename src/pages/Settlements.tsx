import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  // Fetch settlements for the current station
  const { data: settlements = [] } = useQuery({
    queryKey: ['settlements', currentStation?.id],
    queryFn: async () => {
      if (!currentStation?.id) return [];
      try {
        const response = await apiClient.get<{ success: boolean; data: any[] }>(
          `/stations/${currentStation.id}/settlements`
        );
        return response?.data || [];
      } catch (error) {
        console.warn('Failed to fetch settlements:', error);
        return [];
      }
    },
    enabled: !!currentStation?.id,
    retry: false
  });

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
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ClipboardCheck className="w-5 h-5 text-blue-600" />
                </div>
                Daily Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Total Sales */}
                <div className="text-center p-4 bg-white rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-600 font-medium">Total Sales</p>
                  <p className="text-3xl font-bold text-blue-900">₹{summary.sales_total.toLocaleString('en-IN')}</p>
                </div>

                {/* Payment Breakdown */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Payment Breakdown</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Cash */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-green-600 font-bold text-sm">₹</span>
                      </div>
                      <p className="text-xs text-green-700 font-medium">Cash</p>
                      <p className="text-lg font-bold text-green-900">₹{summary.breakdown.cash.toLocaleString('en-IN')}</p>
                    </div>

                    {/* Card */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-blue-600 font-bold text-sm">💳</span>
                      </div>
                      <p className="text-xs text-blue-700 font-medium">Card</p>
                      <p className="text-lg font-bold text-blue-900">₹{summary.breakdown.card.toLocaleString('en-IN')}</p>
                    </div>

                    {/* UPI */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-purple-600 font-bold text-sm">📱</span>
                      </div>
                      <p className="text-xs text-purple-700 font-medium">UPI</p>
                      <p className="text-lg font-bold text-purple-900">₹{summary.breakdown.upi.toLocaleString('en-IN')}</p>
                    </div>

                    {/* Credit */}
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-orange-600 font-bold text-sm">📊</span>
                      </div>
                      <p className="text-xs text-orange-700 font-medium">Credit</p>
                      <p className="text-lg font-bold text-orange-900">₹{summary.breakdown.credit.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>

                {isOwner && (
                  <div className="flex gap-2 pt-4 border-t border-blue-200">
                    <Input
                      id="closureNotes"
                      value={closureNotes}
                      onChange={(e) => setClosureNotes(e.target.value)}
                      placeholder="Optional notes for this closure"
                      className="flex-1"
                    />
                    <Button onClick={handleClosureSubmit} className="bg-blue-600 hover:bg-blue-700">
                      Close Day
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Settlement History */}
          {settlements && settlements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Settlement History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {settlements.map((settlement: any) => (
                    <div key={settlement.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold">{new Date(settlement.date).toLocaleDateString()}</h4>
                          <p className="text-sm text-muted-foreground">
                            Recorded by {settlement.recordedByUser?.name || 'Unknown'} at {new Date(settlement.recordedAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">Status: {settlement.status}</p>
                          {settlement.isFinal && <p className="text-sm text-green-600">Final</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium mb-1">Employee Reported</h5>
                          <p className="text-sm">Cash: ₹{settlement.employeeCash || 0}</p>
                          <p className="text-sm">Online: ₹{settlement.employeeOnline || 0}</p>
                          <p className="text-sm">Credit: ₹{settlement.employeeCredit || 0}</p>
                        </div>
                        <div>
                          <h5 className="font-medium mb-1">Owner Confirmed</h5>
                          <p className="text-sm">Cash: ₹{settlement.actualCash}</p>
                          <p className="text-sm">Online: ₹{settlement.online}</p>
                          <p className="text-sm">Credit: ₹{settlement.credit}</p>
                        </div>
                      </div>
                      {settlement.variance !== '0.00' && (
                        <div className="mt-2">
                          <p className="text-sm text-red-600">Variance: ₹{settlement.variance}</p>
                        </div>
                      )}
                      {settlement.notes && (
                        <div className="mt-2">
                          <p className="text-sm">Notes: {settlement.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
              No sales or payment data found for {new Date(selectedDate).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
