/**
 * Cash Handover Confirmation Page
 * 
 * For Managers and Owners to:
 * - View pending handovers
 * - Confirm cash received
 * - Mark disputes
 * - View handover history
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Banknote,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  User,
  Building2,
  Calendar,
  XCircle,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { cashHandoverService, CashHandover } from '@/services/tenderService';
import { cn } from '@/lib/utils';

export default function CashHandoverConfirmation() {
  const { user } = useAuth();
  const { isOwner } = useRoleAccess();
  const queryClient = useQueryClient();
  
  const [selectedHandover, setSelectedHandover] = useState<CashHandover | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [actualAmount, setActualAmount] = useState<string>('');
  const [confirmNotes, setConfirmNotes] = useState('');
  const [useAcceptAsIs, setUseAcceptAsIs] = useState(false);

  // Fetch pending handovers
  const { data: pendingHandovers = [], isLoading } = useQuery({
    queryKey: ['pending-handovers'],
    queryFn: () => cashHandoverService.getPendingHandovers(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Confirm handover mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHandover) throw new Error('No handover selected');
      
      return cashHandoverService.confirmHandover(selectedHandover.id, {
        acceptAsIs: useAcceptAsIs,
        actualAmount: useAcceptAsIs ? undefined : (parseFloat(actualAmount) || 0),
        notes: confirmNotes || undefined,
      });
    },
    onSuccess: (data) => {
      if (data.status === 'disputed') {
        toast.warning('Handover marked as disputed due to amount difference');
      } else {
        toast.success('Handover confirmed successfully!');
      }
      
      setShowConfirmDialog(false);
      setSelectedHandover(null);
      setActualAmount('');
      setConfirmNotes('');
      setUseAcceptAsIs(false);
      queryClient.invalidateQueries({ queryKey: ['pending-handovers'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to confirm handover');
    },
  });

  // Resolve dispute mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ handoverId, notes }: { handoverId: string; notes: string }) => {
      return cashHandoverService.resolveDispute(handoverId, notes);
    },
    onSuccess: () => {
      toast.success('Dispute resolved successfully!');
      queryClient.invalidateQueries({ queryKey: ['pending-handovers'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to resolve dispute');
    },
  });

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '₹0';
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const getHandoverTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      shift_collection: 'Shift Collection',
      employee_to_manager: 'Employee → Manager',
      manager_to_owner: 'Manager → Owner',
      deposit_to_bank: 'Bank Deposit',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case 'confirmed':
        return <Badge variant="secondary" className="bg-green-100 text-green-700">Confirmed</Badge>;
      case 'disputed':
        return <Badge variant="destructive">Disputed</Badge>;
      case 'resolved':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openConfirmDialog = (handover: CashHandover) => {
    setSelectedHandover(handover);
    setActualAmount(handover.expectedAmount?.toString() || '');
    setShowConfirmDialog(true);
  };

  if (!user) return null;

  // Filter handovers by status
  const pendingItems = pendingHandovers.filter(h => h.status === 'pending');
  const disputedItems = pendingHandovers.filter(h => h.status === 'disputed');

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Banknote className="w-6 h-6 text-green-600" />
          Cash Handover Confirmation
        </h1>
        <p className="text-muted-foreground">
          Confirm cash received from employees and shifts
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto mb-1 text-yellow-600" />
            <p className="text-2xl font-bold">{pendingItems.length}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto mb-1 text-red-600" />
            <p className="text-2xl font-bold">{disputedItems.length}</p>
            <p className="text-xs text-muted-foreground">Disputed</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-green-600" />
            <p className="text-2xl font-bold">--</p>
            <p className="text-xs text-muted-foreground">Today Confirmed</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <Banknote className="w-6 h-6 mx-auto mb-1 text-blue-600" />
            <p className="text-lg font-bold truncate">
              {formatCurrency(pendingItems.reduce((sum, h) => sum + (h.expectedAmount || 0), 0))}
            </p>
            <p className="text-xs text-muted-foreground">Pending Amount</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            Pending
            {pendingItems.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 text-white text-xs rounded-full flex items-center justify-center">
                {pendingItems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="disputed" className="relative">
            Disputed
            {disputedItems.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {disputedItems.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : pendingItems.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <h3 className="font-semibold text-lg">All Caught Up!</h3>
                <p className="text-muted-foreground">
                  No pending handovers to confirm
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingItems.map((handover) => (
                <Card key={handover.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{getHandoverTypeLabel(handover.handoverType)}</Badge>
                          {getStatusBadge(handover.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {handover.fromUser?.name || 'Unknown'}
                          </span>
                          <ArrowRight className="w-3 h-3" />
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {handover.toUser?.name || 'You'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {handover.handoverDate ? format(new Date(handover.handoverDate), 'dd MMM yyyy') : '--'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {handover.station?.name || 'Unknown Station'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Expected</p>
                          <p className="text-lg font-bold text-green-600">
                            {formatCurrency(handover.expectedAmount)}
                          </p>
                        </div>
                        <Button onClick={() => openConfirmDialog(handover)}>
                          Confirm
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Disputed Tab */}
        <TabsContent value="disputed">
          {disputedItems.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <h3 className="font-semibold text-lg">No Disputes</h3>
                <p className="text-muted-foreground">
                  All handovers are reconciled
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {disputedItems.map((handover) => (
                <Card key={handover.id} className="border-red-200 bg-red-50/30">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{getHandoverTypeLabel(handover.handoverType)}</Badge>
                          {getStatusBadge(handover.status)}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Expected:</span>
                          <span className="font-medium">{formatCurrency(handover.expectedAmount)}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span className="text-muted-foreground">Received:</span>
                          <span className="font-medium text-red-600">{formatCurrency(handover.actualAmount)}</span>
                        </div>
                        <p className="text-sm text-red-600 font-medium">
                          Discrepancy: {formatCurrency(handover.difference)}
                        </p>
                        {handover.disputeNotes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Note: {handover.disputeNotes}
                          </p>
                        )}
                      </div>
                      {isOwner && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            const notes = prompt('Enter resolution notes:');
                            if (notes) {
                              resolveMutation.mutate({ handoverId: handover.id, notes });
                            }
                          }}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-green-600" />
              Confirm Cash Handover
            </DialogTitle>
            <DialogDescription>
              Count the cash and enter the actual amount received
            </DialogDescription>
          </DialogHeader>

          {selectedHandover && (
            <div className="space-y-4 py-4">
              {/* Handover Details */}
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">From:</span>
                      <span className="font-medium">{selectedHandover.fromUser?.name || 'Employee'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="font-medium">{getHandoverTypeLabel(selectedHandover.handoverType)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Amount:</span>
                      <span className="font-bold text-green-600">{formatCurrency(selectedHandover.expectedAmount)}</span>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Actual Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="actual">Actual Amount Received *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                  <Input
                    id="actual"
                    type="number"
                    step="0.01"
                    min="0"
                    value={actualAmount}
                    onChange={(e) => {
                      setActualAmount(e.target.value);
                      setUseAcceptAsIs(false);
                    }}
                    disabled={useAcceptAsIs}
                    className="pl-7 text-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Accept As Is Quick Button */}
              {!useAcceptAsIs && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-xs text-muted-foreground">OR</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>
              )}

              {useAcceptAsIs ? (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-700">Accept as is</p>
                      <p className="text-xs text-green-600">Amount: {formatCurrency(selectedHandover.expectedAmount)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUseAcceptAsIs(false)}
                    className="text-green-600 hover:text-green-700"
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setUseAcceptAsIs(true)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Accept {formatCurrency(selectedHandover.expectedAmount)} as is
                </Button>
              )}

              {/* Difference Preview */}
              {actualAmount && (
                <div className={cn(
                  "p-3 rounded-lg text-sm",
                  parseFloat(actualAmount) === selectedHandover.expectedAmount
                    ? "bg-green-50 text-green-700"
                    : parseFloat(actualAmount) < (selectedHandover.expectedAmount || 0)
                    ? "bg-red-50 text-red-700"
                    : "bg-blue-50 text-blue-700"
                )}>
                  {parseFloat(actualAmount) === selectedHandover.expectedAmount ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Amounts match perfectly!
                    </div>
                  ) : parseFloat(actualAmount) < (selectedHandover.expectedAmount || 0) ? (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      Shortage: {formatCurrency((selectedHandover.expectedAmount || 0) - parseFloat(actualAmount))}
                      <span className="text-xs">(Will be marked as disputed)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Excess: {formatCurrency(parseFloat(actualAmount) - (selectedHandover.expectedAmount || 0))}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="Any notes about this handover..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowConfirmDialog(false);
              setUseAcceptAsIs(false);
              setActualAmount('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending || (!useAcceptAsIs && !actualAmount)}
            >
              {confirmMutation.isPending ? 'Confirming...' : 'Confirm Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
