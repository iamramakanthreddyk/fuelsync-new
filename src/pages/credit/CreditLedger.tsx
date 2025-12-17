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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditCard, CheckCircle2 } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { creditService } from '@/services/creditService';
import { notificationService } from '@/services/notificationService';

export default function CreditLedger() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedStationId, setSelectedStationId] = useState<string | undefined>(user?.stations?.[0]?.id);
  const [showAllCreditors, setShowAllCreditors] = useState(false);

  // Fetch creditors and outstanding credits for the selected station
  const { data: creditors = [], isLoading } = useQuery({
    queryKey: ['creditors-ledger', search, selectedStationId, showAllCreditors],
    queryFn: () => creditService.getCreditLedger(search, selectedStationId, showAllCreditors),
    enabled: !!selectedStationId, // Only run query if we have a stationId
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
          <CardTitle>{showAllCreditors ? 'All Credits' : 'Outstanding Credits'}</CardTitle>
          <div className="text-sm text-muted-foreground mt-2">
            {selectedStationId && user?.stations && (
              <p>
                Station: <span className="font-medium text-foreground">
                  {user.stations.find(s => s.id === selectedStationId)?.name || 'Select Station'}
                </span>
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="mb-4 space-y-3 p-4 pb-0">
            {/* Station Selector - Show if user has multiple stations */}
            {user?.stations && user.stations.length > 1 && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Select Station</label>
                <Select value={selectedStationId || ''} onValueChange={setSelectedStationId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a station" />
                  </SelectTrigger>
                  <SelectContent>
                    {user.stations.map(station => (
                      <SelectItem key={station.id} value={station.id}>
                        {station.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Search Input */}
            <div className="flex gap-2 items-center">
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customer name or mobile"
                className="max-w-xs"
              />
              <Button variant="outline" onClick={() => setSearch('')}>Clear</Button>
            </div>

            {/* Show All Creditors Toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-all-creditors"
                checked={showAllCreditors}
                onCheckedChange={(checked) => setShowAllCreditors(checked as boolean)}
              />
              <label
                htmlFor="show-all-creditors"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Show all creditors (including settled)
              </label>
            </div>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (showAllCreditors ? creditors : creditors.filter((c: any) => c.outstanding > 0)).length === 0 ? (
            <Alert>
              <AlertDescription>
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
                {showAllCreditors ? 'No creditors found for this station' : 'All credits are settled - no outstanding balances'}
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
                {(showAllCreditors ? creditors : creditors.filter((c: any) => c.outstanding > 0)).map((c: any) => (
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
