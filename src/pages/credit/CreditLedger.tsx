/**
 * Credit Ledger Page
 * Track outstanding credits, credit limits, and payments per customer
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, CheckCircle2 } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { creditService } from '@/services/creditService';
import { notificationService } from '@/services/notificationService';

export default function CreditLedger() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  // Fetch creditors and outstanding credits
  const { data: creditors = [], isLoading } = useQuery({
    queryKey: ['creditors-ledger', search],
    queryFn: () => creditService.getCreditLedger(search),
    refetchInterval: 60000,
  });

  // Push notifications for over-limit creditors
  creditors.forEach((c: any) => {
    if (c.outstanding > c.creditLimit) {
      notificationService.push(
        'warning',
        `Credit limit exceeded for ${c.name} (₹${c.outstanding.toLocaleString('en-IN')})`,
        `/owner/credit-ledger`,
        { customerId: c.id }
      );
    }
  });

  if (!user) return null;

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-orange-600" />
          Credit Ledger
        </h1>
        <p className="text-muted-foreground">Track outstanding credits and limits per customer</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding Credits</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="mb-4 flex gap-2 items-center">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customer name or mobile"
              className="max-w-xs"
            />
            <Button variant="outline" onClick={() => setSearch('')}>Clear</Button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : creditors.length === 0 ? (
            <Alert>
              <AlertDescription>
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
                No outstanding credits
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Credit Limit</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Last Sale</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditors.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      {c.name}
                    </TableCell>
                    <TableCell>{c.mobile || '--'}</TableCell>
                    <TableCell>
                      {c.creditLimit ? `₹${c.creditLimit.toLocaleString('en-IN')}` : '--'}
                    </TableCell>
                    <TableCell className={c.outstanding > c.creditLimit ? 'text-red-600 font-bold' : 'text-orange-600 font-bold'}>
                      ₹{c.outstanding.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>
                      {c.lastSaleDate ? format(new Date(c.lastSaleDate), 'dd MMM yyyy') : '--'}
                    </TableCell>
                    <TableCell>
                      {c.outstanding === 0 ? (
                        <Badge variant="secondary">Settled</Badge>
                      ) : c.outstanding > c.creditLimit ? (
                        <Badge variant="destructive">Over Limit</Badge>
                      ) : (
                        <Badge variant="outline">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
