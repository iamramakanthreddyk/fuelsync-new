import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableRow, TableCell, TableHead, TableHeader } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient, ApiResponse } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface CreditTxn {
  id: string;
  amount: number;
  transactionDate: string;
  vehicleNumber?: string;
  referenceNumber?: string;
}

interface Props {
  stationId: string;
  creditorId: string;
  creditorName: string;
  onSuccess?: () => void;
}

export default function SettleCreditorDialog({ stationId, creditorId, creditorName, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [transactions, setTransactions] = useState<CreditTxn[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [allocAmounts, setAllocAmounts] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiClient.get<ApiResponse<CreditTxn[]>>(`/credits/stations/${stationId}/credit-transactions?creditorId=${creditorId}&type=credit`)
      .then((res: any) => {
        const data = res?.data || [];
        setTransactions(data);
      })
      .catch((err) => {
        toast({ title: 'Error', description: 'Failed to load credit transactions', variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  }, [open, stationId, creditorId]);

  const totalAlloc = useMemo(() => {
    return transactions.reduce((sum, t) => {
      const val = parseFloat(allocAmounts[t.id] || '0') || 0;
      return sum + val;
    }, 0);
  }, [transactions, allocAmounts]);

  const handleToggle = (id: string) => {
    setSelected(prev => {
      const next = { ...prev, [id]: !prev[id] };
      if (!next[id]) {
        setAllocAmounts(a => ({ ...a, [id]: '' }));
      } else {
        const txn = transactions.find(t => t.id === id);
        setAllocAmounts(a => ({ ...a, [id]: txn ? String(txn.amount) : '0' }));
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    try {
      const allocations = Object.entries(allocAmounts)
        .filter(([id, val]) => parseFloat(val || '0') > 0)
        .map(([creditTransactionId, val]) => ({ creditTransactionId, amount: parseFloat(val) }));

      const payload: any = {
        amount: amount ? parseFloat(amount) : undefined,
        referenceNumber: referenceNumber || undefined,
        notes: notes || undefined,
        invoiceNumber: invoiceNumber || undefined,
        allocations
      };

      // Remove undefined amount if allocations will drive amount
      if (!payload.amount) delete payload.amount;

      const url = `/credits/stations/${stationId}/creditors/${creditorId}/settle`;
      const res = await apiClient.post<ApiResponse<unknown>>(url, payload);
      toast({ title: 'Success', description: 'Settlement recorded' });
      setOpen(false);
      onSuccess && onSuccess();
    } catch (err: any) {
      toast({ title: 'Error', description: (err?.message) || 'Failed to record settlement', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Settle</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settle for {creditorName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Invoice / Document No.</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Invoice number (optional)" />
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Reference number" />
            </div>
          </div>

          <div>
            <Label>Total Amount (optional)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Leave empty to use allocations" />
          </div>

          <div>
            <Label>Apply To Specific Credits</Label>
            <div className="overflow-auto max-h-48 border rounded mt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Credit Amount</TableHead>
                    <TableHead>Apply Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Checkbox checked={!!selected[t.id]} onCheckedChange={() => handleToggle(t.id)} />
                      </TableCell>
                      <TableCell>{new Date(t.transactionDate).toLocaleDateString()}</TableCell>
                      <TableCell>₹{Number(t.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Input disabled={!selected[t.id]} value={allocAmounts[t.id] || ''} onChange={(e) => setAllocAmounts(a => ({ ...a, [t.id]: e.target.value }))} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="text-sm text-muted-foreground mt-2">Total allocations: ₹{totalAlloc.toFixed(2)}</div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Save Settlement</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
