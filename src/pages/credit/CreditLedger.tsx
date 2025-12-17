/**
 * Credit Ledger Page
 * Track outstanding credits, credit limits, and payments per customer
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { creditService, type Creditor, type CreditTransaction } from '@/services/creditService';
import { notificationService } from '@/services/notificationService';

export default function CreditLedger() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedStationId, setSelectedStationId] = useState<string | undefined>(user?.stations?.[0]?.id);
  const [expandedCreditors, setExpandedCreditors] = useState<Set<string>>(new Set());
  // Validate and fix selectedStationId to ensure it's a valid UUID
  useEffect(() => {
    if (user?.stations && user.stations.length > 0) {
      const isValidUUID = selectedStationId && user.stations.some(station => station.id === selectedStationId);
      if (!isValidUUID) {
        // Set to first available station if current selection is invalid
        setSelectedStationId(user.stations[0].id);
      }
    }
  }, [user?.stations, selectedStationId]);

  // Fetch creditors and outstanding credits for the selected station
  const { data: creditors = [], isLoading } = useQuery({
    queryKey: ['creditors-ledger', search, selectedStationId],
    queryFn: () => creditService.getCreditLedger(search, selectedStationId, true),
    enabled: !!selectedStationId, // Only run query if we have a stationId
    refetchInterval: 60000,
  });

  // Toggle expanded state for a creditor
  const toggleExpanded = (creditorId: string) => {
    const newExpanded = new Set(expandedCreditors);
    if (newExpanded.has(creditorId)) {
      newExpanded.delete(creditorId);
    } else {
      newExpanded.add(creditorId);
    }
    setExpandedCreditors(newExpanded);
  };

  // Fetch all creditor transactions for the station (cached and invalidated when creditors change)
  const { data: allTransactionsMap = {} } = useQuery({
    queryKey: ['creditor-transactions', selectedStationId, creditors.length],
    queryFn: async () => {
      if (!selectedStationId || creditors.length === 0) return {};

      const results: Record<string, CreditTransaction[]> = {};
      await Promise.all(
        creditors.map(async (creditor: any) => {
          try {
            const transactions = await creditService.getCreditorTransactions(selectedStationId, creditor.id);
            results[creditor.id] = transactions;
          } catch (error) {
            console.error(`Failed to fetch transactions for creditor ${creditor.id}:`, error);
            results[creditor.id] = [];
          }
        })
      );
      return results;
    },
    enabled: !!selectedStationId && creditors.length > 0,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // Get expanded creditor IDs
  const expandedCreditorIds = Array.from(expandedCreditors);

  // Get transactions for expanded creditors from the cached data
  const transactionsMap = useMemo(() => {
    const result: Record<string, CreditTransaction[]> = {};
    expandedCreditorIds.forEach(creditorId => {
      result[creditorId] = allTransactionsMap[creditorId] || [];
    });
    return result;
  }, [allTransactionsMap, expandedCreditorIds]);

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
    <div className="container mx-auto p-3 sm:p-4 max-w-full sm:max-w-5xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
          Credit Ledger
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">Track outstanding credits and transaction history per customer</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Credits</CardTitle>
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
        <CardContent className="p-2 sm:p-6">
          <div className="mb-4 space-y-3 p-2 sm:p-4 pb-0">
            {/* Station Selector - Show if user has multiple stations */}
            {user?.stations && user.stations.length > 1 && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Select Station</label>
                <Select value={selectedStationId || ''} onValueChange={(value) => {
                    // Only set if it's a valid station ID
                    if (user?.stations?.some(station => station.id === value)) {
                      setSelectedStationId(value);
                    }
                  }}>
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
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customer name or mobile"
                className="flex-1"
              />
              <Button variant="outline" onClick={() => setSearch('')} className="w-full sm:w-auto">Clear</Button>
            </div>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : creditors.length === 0 ? (
            <Alert>
              <AlertDescription>
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
                No creditors with transaction history
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 sm:w-10"></TableHead>
                  <TableHead className="text-xs sm:text-sm">Customer</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Mobile</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden md:table-cell">Credit Limit</TableHead>
                  <TableHead className="text-xs sm:text-sm">Outstanding</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Last Sale</TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditors.map((c: any) => {
                  const isExpanded = expandedCreditors.has(c.id);
                  const transactions = transactionsMap[c.id] || [];
                  
                  return (
                    <React.Fragment key={c.id}>
                      <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={() => toggleExpanded(c.id)}>
                        <TableCell className="p-2 sm:p-4">
                          <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-6 sm:w-6 p-0 touch-manipulation">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 sm:h-4 sm:w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4 sm:h-4 sm:w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium p-2 sm:p-4">
                          <div className="flex flex-col">
                            <span className="text-sm sm:text-base">{c.name}</span>
                            <span className="text-xs text-muted-foreground sm:hidden">{c.mobile || '--'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="p-2 sm:p-4 hidden sm:table-cell">{c.mobile || '--'}</TableCell>
                        <TableCell className="p-2 sm:p-4 hidden md:table-cell">
                          {c.creditLimit ? `₹${c.creditLimit.toLocaleString('en-IN')}` : '--'}
                        </TableCell>
                        <TableCell className={`p-2 sm:p-4 font-bold ${c.outstanding > c.creditLimit ? 'text-red-600' : 'text-orange-600'}`}>
                          ₹{c.outstanding.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="p-2 sm:p-4 hidden lg:table-cell">
                          {c.lastSaleDate ? format(new Date(c.lastSaleDate), 'dd MMM yyyy') : '--'}
                        </TableCell>
                        <TableCell className="p-2 sm:p-4">
                          {c.outstanding === 0 ? (
                            <Badge variant="secondary" className="text-xs">Settled</Badge>
                          ) : c.outstanding > c.creditLimit ? (
                            <Badge variant="destructive" className="text-xs">Over Limit</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Active</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="p-0">
                            <div className="bg-muted/30 p-4 sm:p-6">
                              <h4 className="font-medium mb-4 text-sm text-foreground">Transaction History</h4>
                              {transactions.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4">No transactions found</p>
                              ) : (
                                <div className="space-y-3">
                                  {transactions.map((transaction) => (
                                    <div key={transaction.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-background rounded-lg border text-sm gap-3 shadow-sm">
                                      <div className="flex items-start gap-4">
                                        <div className={`w-4 h-4 rounded-full mt-1 flex-shrink-0 ${
                                          transaction.transactionType === 'credit' ? 'bg-red-500' : 'bg-green-500'
                                        }`} />
                                        <div className="min-w-0 flex-1">
                                          <div className="font-semibold text-base mb-1">
                                            {transaction.transactionType === 'credit' ? 'Credit Purchase' : 'Settlement Payment'}
                                          </div>
                                          <div className="text-xs text-muted-foreground mb-2">
                                            {format(new Date(transaction.transactionDate), 'dd MMM yyyy, hh:mm a')}
                                            {transaction.enteredByUser && ` • ${transaction.enteredByUser.name}`}
                                          </div>
                                          {transaction.description && (
                                            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                              {transaction.description}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right sm:text-right flex-shrink-0">
                                        <div className={`font-bold text-xl ${
                                          transaction.transactionType === 'credit' ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                          {transaction.transactionType === 'credit' ? '+' : '-'}₹{transaction.amount.toLocaleString('en-IN')}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
