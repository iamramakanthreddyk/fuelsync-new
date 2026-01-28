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
import { CreditCard, CheckCircle2, ChevronDown, ChevronRight, Phone, Calendar, DollarSign, AlertCircle } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { creditService, type Creditor, type CreditTransaction } from '@/services/creditService';
import { notificationService } from '@/services/notificationService';

// CreditorCard component for mobile-friendly display
function CreditorCard({ creditor, stationId }: { creditor: any; stationId?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['creditor-transactions', creditor.id, stationId],
    queryFn: () => creditService.getCreditorTransactions(stationId!, creditor.id),
    enabled: !!stationId && isExpanded,
  });

  const isOverLimit = creditor.outstanding > creditor.creditLimit;
  const isSettled = creditor.outstanding === 0;

  return (
    <Card className={`transition-all duration-200 ${isOverLimit ? 'border-red-200 bg-red-50/50' : isSettled ? 'border-green-200 bg-green-50/50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold truncate">{creditor.name}</CardTitle>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              {creditor.mobile && (
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  <span>{creditor.mobile}</span>
                </div>
              )}
              {creditor.lastSaleDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(creditor.lastSaleDate), 'dd MMM')}</span>
                </div>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-2"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className={`text-xl font-bold ${isOverLimit ? 'text-red-600' : 'text-orange-600'}`}>
              ₹{creditor.outstanding.toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Credit Limit</p>
            <p className="text-lg font-semibold">
              {creditor.creditLimit ? `₹${creditor.creditLimit.toLocaleString('en-IN')}` : '--'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Badge
            variant={isSettled ? "secondary" : isOverLimit ? "destructive" : "outline"}
            className="text-xs"
          >
            {isSettled ? "Settled" : isOverLimit ? "Over Limit" : "Active"}
          </Badge>

          {isOverLimit && (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Over by ₹{(creditor.outstanding - creditor.creditLimit).toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Transaction History
            </h4>

            {transactionsLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No transactions found</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {transactions.map((transaction: CreditTransaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-3 h-3 rounded-full ${transaction.transactionType === 'credit' ? 'bg-red-500' : 'bg-green-500'}`} />
                        <span className="font-medium text-sm">
                          {transaction.transactionType === 'credit' ? 'Credit Purchase' : 'Settlement Payment'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(transaction.transactionDate), 'dd MMM, hh:mm a')}
                      </div>
                      {transaction.description && (
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {transaction.description}
                        </div>
                      )}
                    </div>
                    <div className={`font-bold text-lg ${transaction.transactionType === 'credit' ? 'text-red-600' : 'text-green-600'}`}>
                      {transaction.transactionType === 'credit' ? '+' : '-'}₹{transaction.amount.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CreditLedger() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedStationId, setSelectedStationId] = useState<string | undefined>(user?.stations?.[0]?.id);

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

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalOutstanding = creditors.reduce((sum: number, c: any) => sum + (c.outstanding || 0), 0);
    const overLimitCount = creditors.filter((c: any) => c.outstanding > c.creditLimit).length;
    const activeCredits = creditors.filter((c: any) => c.outstanding > 0).length;

    return { totalOutstanding, overLimitCount, activeCredits };
  }, [creditors]);

  if (!user) return null;

  return (
    <div className="container mx-auto p-3 sm:p-4 max-w-full sm:max-w-6xl space-y-4 sm:space-y-6">
      {/* Header with Summary */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
            Credit Ledger
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Track outstanding credits and customer payments</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Outstanding</p>
                  <p className="text-2xl font-bold">₹{summaryStats.totalOutstanding.toLocaleString('en-IN')}</p>
                </div>
                <CreditCard className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Credits</p>
                  <p className="text-2xl font-bold">{summaryStats.activeCredits}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          {summaryStats.overLimitCount > 0 && (
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Over Limit</p>
                    <p className="text-2xl font-bold text-red-600">{summaryStats.overLimitCount}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Station Selector */}
            {user?.stations && user.stations.length > 1 && (
              <div className="w-full sm:w-auto">
                <Select value={selectedStationId || ''} onValueChange={(value) => {
                    if (user?.stations?.some(station => station.id === value)) {
                      setSelectedStationId(value);
                    }
                  }}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Select station" />
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

            {/* Search */}
            <div className="flex-1 w-full sm:w-auto">
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customers..."
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Creditors List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading credit ledger...</p>
          </CardContent>
        </Card>
      ) : creditors.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No Credit Accounts</h3>
            <p className="text-muted-foreground">All customer accounts are settled</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {creditors.map((creditor: any) => (
            <CreditorCard
              key={creditor.id}
              creditor={creditor}
              stationId={selectedStationId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
