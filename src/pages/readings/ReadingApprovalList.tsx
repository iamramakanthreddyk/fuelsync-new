/**
 * Reading Approval List Page
 * For managers to approve/reject nozzle readings before locking
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Fuel } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { readingService } from '@/services/readingService';
import { notificationService } from '@/services/notificationService';

export default function ReadingApprovalList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedReading, setSelectedReading] = useState<any | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Fetch all readings and filter for pending status client-side
  const { data: allReadings = { data: [] }, isLoading } = useQuery({
    queryKey: ['all-readings'],
    queryFn: () => readingService.getReadings(),
    refetchInterval: 30000,
  });

  // Filter for pending readings (assuming a 'status' property exists on reading)
  const readings = allReadings.data.filter((r: any) => r.status === 'pending');

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReading) throw new Error('No reading selected');
      return readingService.approveReading(selectedReading.id);
    },
    onSuccess: () => {
      toast.success('Reading approved');
      setShowDialog(false);
      setSelectedReading(null);
      queryClient.invalidateQueries({ queryKey: ['pending-readings'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve reading');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReading) throw new Error('No reading selected');
      if (!rejectionReason) throw new Error('Rejection reason required');
      return readingService.rejectReading(selectedReading.id, rejectionReason);
    },
    onSuccess: () => {
      toast.warning('Reading rejected');
      setShowDialog(false);
      setSelectedReading(null);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['pending-readings'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject reading');
    },
  });

  // Push notifications for new pending readings
  readings.forEach((reading: any) => {
    if (reading.approvalStatus === 'pending') {
      notificationService.push(
        'action',
        `Reading pending approval for ${reading.station?.name || '--'} / ${reading.nozzle?.name || '--'}`,
        `/owner/reading-approvals`,
        { readingId: reading.id }
      );
    }
  });

  if (!user) return null;

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Fuel className="w-6 h-6 text-yellow-600" />
          Reading Approval
        </h1>
        <p className="text-muted-foreground">Approve or reject pending nozzle readings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Readings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : readings.length === 0 ? (
            <Alert>
              <AlertDescription>
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
                All readings are approved
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Nozzle</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Sale Value</TableHead>
                  <TableHead>Cash</TableHead>
                  <TableHead>Online</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readings.map((reading: any) => (
                  <TableRow key={reading.id}>
                    <TableCell>
                      {reading.readingDate ? format(new Date(reading.readingDate), 'dd MMM yyyy') : '--'}
                    </TableCell>
                    <TableCell>{reading.station?.name || '--'}</TableCell>
                    <TableCell>{reading.nozzle?.name || '--'}</TableCell>
                    <TableCell>{reading.employee?.name || '--'}</TableCell>
                    <TableCell>{reading.saleValue?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '--'}</TableCell>
                    <TableCell>{reading.paymentBreakdown?.cash?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '--'}</TableCell>
                    <TableCell>{reading.paymentBreakdown?.online?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '--'}</TableCell>
                    <TableCell>{reading.paymentBreakdown?.credit?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '--'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{reading.approvalStatus || 'pending'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => { setSelectedReading(reading); setShowDialog(true); }}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Reading</DialogTitle>
            <DialogDescription>Approve or reject this reading</DialogDescription>
          </DialogHeader>
          {selectedReading && (
            <div className="space-y-3 py-2">
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Station</p>
                  <p className="font-medium">{selectedReading.station?.name || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nozzle</p>
                  <p className="font-medium">{selectedReading.nozzle?.name || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Employee</p>
                  <p className="font-medium">{selectedReading.employee?.name || '--'}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Sale Value</p>
                  <p className="font-medium">{selectedReading.saleValue?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cash</p>
                  <p className="font-medium">{selectedReading.paymentBreakdown?.cash?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Online</p>
                  <p className="font-medium">{selectedReading.paymentBreakdown?.online?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Credit</p>
                  <p className="font-medium">{selectedReading.paymentBreakdown?.credit?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '--'}</p>
                </div>
              </div>
              {selectedReading.approvalStatus === 'rejected' && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertDescription>
                    <XCircle className="w-4 h-4 text-red-600 mr-2" />
                    Rejected: {selectedReading.rejectionReason}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  {approveMutation.isPending ? 'Approving...' : 'Approve'}
                </Button>
                <Button variant="destructive" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending || !rejectionReason}>
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                </Button>
              </div>
              <div className="mt-2">
                <Textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason (required to reject)"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter />
        </DialogContent>
      </Dialog>
    </div>
  );
}
