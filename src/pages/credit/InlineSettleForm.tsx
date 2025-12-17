import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  stationId?: string;
  creditorId: string;
  onSuccess: () => void;
}

export default function InlineSettleForm({ stationId, creditorId, onSuccess }: Props) {
  const [amount, setAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({ title: 'Amount required', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }
    if (!stationId) {
      toast({ title: 'Station ID missing', description: 'Cannot settle without station ID', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post(
        `/stations/${stationId}/creditors/${creditorId}/settle`,
        {
          amount: Number(amount),
          referenceNumber: referenceNumber || undefined,
          notes: notes || undefined,
        }
      );
      toast({ title: 'Settlement recorded', description: 'Payment recorded successfully', variant: 'success' });
      setAmount('');
      setReferenceNumber('');
      setNotes('');
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to record settlement', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-2 p-2 border rounded bg-orange-50">
      <Label htmlFor="amount">Amount<span className="text-red-500">*</span></Label>
      <Input id="amount" value={amount} onChange={e => setAmount(e.target.value)} required type="number" min="1" step="0.01" placeholder="Enter amount" />
      <Label htmlFor="referenceNumber">Reference</Label>
      <Input id="referenceNumber" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="Reference number" />
      <Label htmlFor="notes">Notes</Label>
      <Input id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" />
      <Button type="submit" size="sm" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Settle'}</Button>
    </form>
  );
}