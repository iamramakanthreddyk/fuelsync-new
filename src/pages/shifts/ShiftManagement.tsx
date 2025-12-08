/**
 * Shift Management Page
 * 
 * Allows employees to:
 * - Start a new shift
 * - View active shift status
 * - End shift with cash reconciliation
 * 
 * Managers can:
 * - View all active shifts at station
 * - Cancel shifts if needed
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';

import {
  Clock,
  Play,
  Square,
  Banknote,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  IndianRupee,
  Timer,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { shiftService, dashboardAlertsService } from '@/services/tenderService';
import { cn } from '@/lib/utils';

export default function ShiftManagement() {
  const { user } = useAuth();
  const { stations: userStations, isManager, isOwner } = useRoleAccess();
  const queryClient = useQueryClient();
  const [selectedStation, setSelectedStation] = useState<string>('');
  // Pending handovers alert (depends on selectedStation)
  const { data: pendingAlert } = useQuery({
    queryKey: ['pending-handovers-alert', selectedStation],
    queryFn: () => dashboardAlertsService.getPendingHandoversAlert(),
    enabled: !!selectedStation,
    refetchInterval: 30000,
  });
  const [showEndShiftDialog, setShowEndShiftDialog] = useState(false);
  const [showStartShiftDialog, setShowStartShiftDialog] = useState(false);
  
  // End shift form state
  const [cashCollected, setCashCollected] = useState<string>('');
  const [onlineCollected, setOnlineCollected] = useState<string>('');
  const [endNotes, setEndNotes] = useState('');

  // Start shift form state
  const [shiftType, setShiftType] = useState<'morning' | 'evening' | 'night' | 'full_day'>('morning');
  const [startNotes, setStartNotes] = useState('');

  // Set default station
  useEffect(() => {
    if (userStations.length > 0 && !selectedStation) {
      setSelectedStation(userStations[0].id);
    }
  }, [userStations, selectedStation]);

  // Fetch shift status
  const { data: shiftStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['shift-status', selectedStation],
    queryFn: () => dashboardAlertsService.getShiftStatus(),
    enabled: !!selectedStation,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const activeShift = shiftStatus?.myActiveShift;

  // Start shift mutation
  const startShiftMutation = useMutation({
    mutationFn: async () => {
      return shiftService.startShift({
        stationId: selectedStation,
        shiftType,
        notes: startNotes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Shift started successfully!');
      setShowStartShiftDialog(false);
      setStartNotes('');
      queryClient.invalidateQueries({ queryKey: ['shift-status'] });
      refetchStatus();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start shift');
    },
  });

  // End shift mutation
  const endShiftMutation = useMutation({
    mutationFn: async () => {
      if (!activeShift) throw new Error('No active shift');
      
      return shiftService.endShift(activeShift.id, {
        cashCollected: parseFloat(cashCollected) || 0,
        onlineCollected: parseFloat(onlineCollected) || 0,
        endNotes: endNotes || undefined,
      });
    },
    onSuccess: (data) => {
      const diff = data.cashDifference || 0;
      if (diff === 0) {
        toast.success('Shift ended successfully! Cash balanced perfectly.');
      } else if (diff > 0) {
        toast.warning(`Shift ended. Shortage of ₹${Math.abs(diff).toFixed(2)} detected.`);
      } else {
        toast.info(`Shift ended. Excess of ₹${Math.abs(diff).toFixed(2)} recorded.`);
      }
      
      setShowEndShiftDialog(false);
      setCashCollected('');
      setOnlineCollected('');
      setEndNotes('');
      queryClient.invalidateQueries({ queryKey: ['shift-status'] });
      refetchStatus();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to end shift');
    },
  });

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '₹0';
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return '--:--';
    try {
      return format(new Date(`2000-01-01T${timeStr}`), 'hh:mm a');
    } catch {
      return timeStr;
    }
  };

  const getShiftDuration = () => {
    if (!activeShift?.startTime) return '0h 0m';
    try {
      const start = new Date(`2000-01-01T${activeShift.startTime}`);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    } catch {
      return '0h 0m';
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            Shift Management
          </h1>
          <p className="text-muted-foreground">
            Track your shift, sales, and cash collections
          </p>
        </div>
        
        {/* Station Selector */}
        {userStations.length > 1 && (
          <Select value={selectedStation} onValueChange={setSelectedStation}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select station" />
            </SelectTrigger>
            <SelectContent>
              {userStations.map((station) => (
                <SelectItem key={station.id} value={station.id}>
                  {station.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          )}

          {/* Pending handovers badge for managers/owners */}
          {(isManager || isOwner) && pendingAlert && (
            <div className="ml-4">
              <Badge className="bg-yellow-100 text-yellow-800">
                {pendingAlert.pendingCount || 0} pending handovers
              </Badge>
            </div>
        )}
      </div>

      {statusLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : activeShift ? (
        /* Active Shift View */
        <div className="space-y-4">
          {/* Active Shift Card */}
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50/50 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <CardTitle className="text-lg">Active Shift</CardTitle>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {activeShift.shiftType?.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <CardDescription>
                Started at {formatTime(activeShift.startTime)} • Running for {getShiftDuration()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Shift Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
                  <Gauge className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                  <p className="text-xs text-muted-foreground">Readings</p>
                  <p className="text-lg font-bold">{activeShift.readingsCount || 0}</p>
                </div>
                <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
                  <TrendingUp className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                  <p className="text-xs text-muted-foreground">Litres</p>
                  <p className="text-lg font-bold">{(activeShift.totalLitresSold || 0).toFixed(1)}</p>
                </div>
                <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
                  <IndianRupee className="w-5 h-5 mx-auto mb-1 text-green-600" />
                  <p className="text-xs text-muted-foreground">Sales</p>
                  <p className="text-lg font-bold">{formatCurrency(activeShift.totalSalesAmount)}</p>
                </div>
                <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
                  <Banknote className="w-5 h-5 mx-auto mb-1 text-orange-600" />
                  <p className="text-xs text-muted-foreground">Expected Cash</p>
                  <p className="text-lg font-bold">{formatCurrency(activeShift.expectedCash)}</p>
                </div>
              </div>

              {/* End Shift Button */}
              <Button
                onClick={() => setShowEndShiftDialog(true)}
                variant="destructive"
                className="w-full"
                size="lg"
              >
                <Square className="w-4 h-4 mr-2" />
                End Shift & Submit Cash
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => window.location.href = '/data-entry'}>
              <Gauge className="w-4 h-4 mr-2" />
              Add Reading
            </Button>
            <Button variant="outline" disabled>
              <Clock className="w-4 h-4 mr-2" />
              Shift History
            </Button>
            {(isManager || isOwner) && (
              <Button variant="secondary" onClick={() => window.location.href = '/cash-handovers'}>
                <Banknote className="w-4 h-4 mr-2" />
                Reconcile
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* No Active Shift View */
        <Card className="border-2 border-dashed">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
              <Timer className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No Active Shift</h3>
              <p className="text-muted-foreground">
                Start a shift to begin recording sales and cash collections
              </p>
            </div>
            <Button
              onClick={() => setShowStartShiftDialog(true)}
              size="lg"
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Start New Shift
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Manager View: Other Active Shifts */}
      {(isManager || isOwner) && shiftStatus?.stationActiveShifts && shiftStatus.stationActiveShifts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Other Active Shifts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {shiftStatus.stationActiveShifts
                .filter(s => s.id !== activeShift?.id)
                .map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{shift.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {shift.shiftType} • Started {formatTime(shift.startTime)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      Active
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Summary */}
      {shiftStatus && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today's Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Shifts</p>
                <p className="text-xl font-bold">{shiftStatus.todayShiftsCount || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-xl font-bold text-green-600">{shiftStatus.todayCompletedCount || 0}</p>
              </div>
              <div>
                <Progress
                  value={shiftStatus.todayShiftsCount 
                    ? (shiftStatus.todayCompletedCount / shiftStatus.todayShiftsCount) * 100 
                    : 0}
                  className="w-24 h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Start Shift Dialog */}
      <Dialog open={showStartShiftDialog} onOpenChange={setShowStartShiftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-green-600" />
              Start New Shift
            </DialogTitle>
            <DialogDescription>
              Begin tracking your sales and cash collections
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Shift Type</Label>
              <Select value={shiftType} onValueChange={(v) => setShiftType(v as typeof shiftType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning (6 AM - 2 PM)</SelectItem>
                  <SelectItem value="evening">Evening (2 PM - 10 PM)</SelectItem>
                  <SelectItem value="night">Night (10 PM - 6 AM)</SelectItem>
                  <SelectItem value="full_day">Full Day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={startNotes}
                onChange={(e) => setStartNotes(e.target.value)}
                placeholder="Any notes for this shift..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartShiftDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => startShiftMutation.mutate()}
              disabled={startShiftMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {startShiftMutation.isPending ? 'Starting...' : 'Start Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Shift Dialog */}
      <Dialog open={showEndShiftDialog} onOpenChange={setShowEndShiftDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-green-600" />
              End Shift - Cash Reconciliation
            </DialogTitle>
            <DialogDescription>
              Enter the actual cash and online amounts collected
            </DialogDescription>
          </DialogHeader>

          {activeShift && (
            <div className="space-y-4 py-4">
              {/* Expected Amounts */}
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Sales</p>
                      <p className="font-bold">{formatCurrency(activeShift.totalSalesAmount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expected Cash</p>
                      <p className="font-bold">{formatCurrency(activeShift.expectedCash)}</p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Cash Input */}
              <div className="space-y-2">
                <Label htmlFor="cash">Actual Cash Collected *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                  <Input
                    id="cash"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashCollected}
                    onChange={(e) => setCashCollected(e.target.value)}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Online Input */}
              <div className="space-y-2">
                <Label htmlFor="online">Online/Card Collected</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                  <Input
                    id="online"
                    type="number"
                    step="0.01"
                    min="0"
                    value={onlineCollected}
                    onChange={(e) => setOnlineCollected(e.target.value)}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Difference Preview */}
              {cashCollected && (
                <div className={cn(
                  "p-3 rounded-lg text-sm",
                  parseFloat(cashCollected) === (activeShift.expectedCash || 0)
                    ? "bg-green-50 text-green-700"
                    : parseFloat(cashCollected) < (activeShift.expectedCash || 0)
                    ? "bg-yellow-50 text-yellow-700"
                    : "bg-blue-50 text-blue-700"
                )}>
                  {parseFloat(cashCollected) === (activeShift.expectedCash || 0) ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Cash balanced perfectly!
                    </div>
                  ) : parseFloat(cashCollected) < (activeShift.expectedCash || 0) ? (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Shortage: {formatCurrency((activeShift.expectedCash || 0) - parseFloat(cashCollected))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Excess: {formatCurrency(parseFloat(cashCollected) - (activeShift.expectedCash || 0))}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={endNotes}
                  onChange={(e) => setEndNotes(e.target.value)}
                  placeholder="Any discrepancy explanation..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndShiftDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => endShiftMutation.mutate()}
              disabled={endShiftMutation.isPending || !cashCollected}
              variant="destructive"
            >
              {endShiftMutation.isPending ? 'Ending...' : 'End Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
