/**
 * Improved Payment Allocation Form Component
 * Features:
 * - Auto-sync online payment field with breakdown total
 * - Better visual feedback and organization
 * - Quick fill buttons for common scenarios
 * - Real-time validation with clear error messages
 * - Improved accessibility
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Plus,
  Trash2
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { safeToFixed } from '@/lib/format-utils';
import { toNumber } from '@/utils/number';
import type { PaymentAllocation, PaymentSubBreakdown, CreditAllocation, UpiSubType, CardSubType, OilCompanySubType, Creditor } from '@/types/finance';

interface PaymentAllocationFormProps {
  paymentAllocation: PaymentAllocation;
  setPaymentAllocation: (value: PaymentAllocation | ((prev: PaymentAllocation) => PaymentAllocation)) => void;
  totalRequired: number;
  creditors?: Creditor[];
  nonSampleReadingsCount: number;
}

export function PaymentAllocationForm({
  paymentAllocation,
  setPaymentAllocation,
  totalRequired,
  creditors = [],
  nonSampleReadingsCount
}: PaymentAllocationFormProps) {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [breakdownMode, setBreakdownMode] = useState<'manual' | 'auto'>('auto');

  // Auto-sync online field from breakdown
  useEffect(() => {
    if (!paymentAllocation.onlineBreakdown) return;
    
    const breakdownTotal =
      Object.values(paymentAllocation.onlineBreakdown.upi || {}).reduce((sum, v) => sum + (v || 0), 0) +
      Object.values(paymentAllocation.onlineBreakdown.card || {}).reduce((sum, v) => sum + (v || 0), 0) +
      Object.values(paymentAllocation.onlineBreakdown.oilCompany || {}).reduce((sum, v) => sum + (v || 0), 0);

    if (breakdownMode === 'auto' && Math.abs(breakdownTotal - toNumber(paymentAllocation.online)) > 0.01) {
      setPaymentAllocation(prev => ({
        ...prev,
        online: breakdownTotal.toString()
      }));
    }
  }, [paymentAllocation.onlineBreakdown, breakdownMode, paymentAllocation.online, setPaymentAllocation]);

  // Calculate totals
  const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + toNumber(c.amount), 0);
  const breakdownTotal =
    Object.values(paymentAllocation.onlineBreakdown?.upi || {}).reduce((sum, v) => sum + (v || 0), 0) +
    Object.values(paymentAllocation.onlineBreakdown?.card || {}).reduce((sum, v) => sum + (v || 0), 0) +
    Object.values(paymentAllocation.onlineBreakdown?.oilCompany || {}).reduce((sum, v) => sum + (v || 0), 0);

  const totalAllocated = toNumber(paymentAllocation.cash) + Math.max(toNumber(paymentAllocation.online), breakdownTotal) + totalCredit;
  const difference = totalAllocated - totalRequired;
  const isMatched = Math.abs(difference) <= 0.01;

  // Quick fill handlers
  const handleQuickFill = useCallback((method: 'all_cash' | 'smart' | 'equal') => {
    if (totalRequired <= 0) return;

    switch (method) {
      case 'all_cash':
        setPaymentAllocation(prev => ({
          ...prev,
          cash: totalRequired.toString(),
          online: '0',
          onlineBreakdown: null,
          credits: []
        }));
        break;

      case 'smart': {
        // Suggest distribution based on common patterns
        const half = totalRequired / 2;
        setPaymentAllocation(prev => ({
          ...prev,
          cash: Math.round(half * 100) / 100,
          online: Math.round(half * 100) / 100,
          onlineBreakdown: initializeBreakdown(),
          credits: []
        }));
        break;
      }

      case 'equal': {
        // Three-way split
        const third = totalRequired / 3;
        setPaymentAllocation(prev => ({
          ...prev,
          cash: Math.round(third * 100) / 100,
          online: Math.round(third * 100) / 100,
          onlineBreakdown: initializeBreakdown(),
          credits: []
        }));
        break;
      }
    }
  }, [totalRequired, setPaymentAllocation]);

  // Update breakdown field
  const handleUpdateBreakdown = useCallback((path: string, value: string) => {
    setPaymentAllocation(prev => {
      if (!prev.onlineBreakdown) return prev;
      
      const breakdown = { ...prev.onlineBreakdown };
      const keys = path.split('.');
      let current: any = breakdown;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      const lastKey = keys[keys.length - 1];
      current[lastKey] = toNumber(value);
      
      return { ...prev, onlineBreakdown: breakdown };
    });
  }, [setPaymentAllocation]);

  // Toggle breakdown
  const handleToggleBreakdown = useCallback((open: boolean) => {
    setIsBreakdownOpen(open);
    if (open && !paymentAllocation.onlineBreakdown) {
      setPaymentAllocation(prev => ({
        ...prev,
        onlineBreakdown: initializeBreakdown()
      }));
    }
  }, [paymentAllocation.onlineBreakdown, setPaymentAllocation]);

  if (nonSampleReadingsCount === 0) return null;

  return (
    <Card className="shadow-lg border-2">
      <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Payment Allocation</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Status:</span>
            <Badge variant={isMatched ? "default" : "destructive"} className="px-3 py-1">
              {isMatched ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Matched
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Mismatch
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Summary Info */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-white p-2 rounded border-l-4 border-blue-500">
            <p className="text-gray-600">Required</p>
            <p className="font-bold text-blue-600">₹{safeToFixed(totalRequired, 2)}</p>
          </div>
          <div className="bg-white p-2 rounded border-l-4 border-green-500">
            <p className="text-gray-600">Allocated</p>
            <p className="font-bold text-green-600">₹{safeToFixed(totalAllocated, 2)}</p>
          </div>
          <div className="bg-white p-2 rounded border-l-4 border-yellow-500">
            <p className="text-gray-600">Difference</p>
            <p className={`font-bold ${difference > 0 ? 'text-orange-600' : difference < 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{safeToFixed(Math.abs(difference), 2)} {difference > 0 ? 'excess' : difference < 0 ? 'short' : 'matched'}
            </p>
          </div>
          <div className="bg-white p-2 rounded border-l-4 border-purple-500">
            <p className="text-gray-600">Status</p>
            <p className={`font-bold ${isMatched ? 'text-green-600' : 'text-red-600'}`}>
              {isMatched ? '✓ Ready' : '✗ Fix needed'}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Payment Method Tabs */}
        <Tabs defaultValue="simple" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="simple">Quick Entry</TabsTrigger>
            <TabsTrigger value="detailed">Detailed Breakdown</TabsTrigger>
          </TabsList>

          {/* Simple Tab */}
          <TabsContent value="simple" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cash Payment */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">🏦 Cash Payment</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAllocation.cash}
                  onChange={(e) => setPaymentAllocation(prev => ({ ...prev, cash: e.target.value }))}
                  placeholder="0.00"
                  className="w-full font-mono"
                />
                <p className="text-xs text-gray-500">Direct cash payments</p>
              </div>

              {/* Online Payment */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  💳 Online Payment
                  {paymentAllocation.onlineBreakdown && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      Synced
                    </span>
                  )}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAllocation.online}
                  onChange={(e) => {
                    setPaymentAllocation(prev => ({ ...prev, online: e.target.value }));
                    setBreakdownMode('manual');
                  }}
                  placeholder="0.00"
                  className="w-full font-mono"
                  disabled={breakdownMode === 'auto' && paymentAllocation.onlineBreakdown ? false : false}
                />
                <p className="text-xs text-gray-500">
                  {paymentAllocation.onlineBreakdown ? 'Auto-synced from breakdown' : 'Total online payments'}
                </p>
              </div>

              {/* Credit Payment */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📋 Credit Payment</Label>
                <Input
                  type="text"
                  value={`₹${safeToFixed(totalCredit, 2)}`}
                  disabled
                  className="w-full bg-gray-100"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500">Total credit allocations</p>
              </div>
            </div>

            {/* Quick Fill Buttons */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-blue-900 mb-3">💡 Quick Fill Options</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickFill('all_cash')}
                  className="border-blue-300 hover:bg-blue-100"
                >
                  <span className="text-sm">All Cash</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickFill('smart')}
                  className="border-blue-300 hover:bg-blue-100"
                >
                  <span className="text-sm">50/50 Split</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickFill('equal')}
                  className="border-blue-300 hover:bg-blue-100"
                >
                  <span className="text-sm">3-Way Split</span>
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Detailed Breakdown Tab */}
          <TabsContent value="detailed" className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold">Breakdown Mode</p>
                <p>The Online Payment field will auto-sync with your breakdown entries when enabled.</p>
              </div>
            </div>

            <Collapsible open={isBreakdownOpen} onOpenChange={handleToggleBreakdown}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between text-base font-semibold"
                >
                  <span>Payment Method Details</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isBreakdownOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-4">
                {paymentAllocation.onlineBreakdown && (
                  <div className="space-y-4 border-t pt-4">
                    {/* UPI Methods */}
                    <BreakdownSection label="☎️ UPI Payment Methods">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                          { key: 'gpay', label: 'Google Pay' },
                          { key: 'phonepe', label: 'PhonePe' },
                          { key: 'paytm', label: 'Paytm' },
                          { key: 'amazon_pay', label: 'Amazon Pay' },
                          { key: 'bhim', label: 'BHIM' },
                          { key: 'cred', label: 'CRED' },
                          { key: 'other_upi', label: 'Other UPI' }
                        ].map(({ key, label }) => (
                          <div key={key} className="space-y-1">
                            <Label htmlFor={`upi-${key}`} className="text-xs font-medium">{label}</Label>
                            <Input
                              id={`upi-${key}`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={paymentAllocation.onlineBreakdown?.upi?.[key as UpiSubType] || ''}
                              onChange={(e) => {
                                handleUpdateBreakdown(`upi.${key}`, e.target.value);
                                setBreakdownMode('auto');
                              }}
                              placeholder="0.00"
                              className="text-sm font-mono h-8"
                            />
                          </div>
                        ))}
                      </div>
                    </BreakdownSection>

                    {/* Card Methods */}
                    <BreakdownSection label="💳 Card Payment Methods">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { key: 'debit_card', label: 'Debit Card' },
                          { key: 'credit_card', label: 'Credit Card' }
                        ].map(({ key, label }) => (
                          <div key={key} className="space-y-1">
                            <Label htmlFor={`card-${key}`} className="text-xs font-medium">{label}</Label>
                            <Input
                              id={`card-${key}`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={paymentAllocation.onlineBreakdown?.card?.[key as CardSubType] || ''}
                              onChange={(e) => {
                                handleUpdateBreakdown(`card.${key}`, e.target.value);
                                setBreakdownMode('auto');
                              }}
                              placeholder="0.00"
                              className="text-sm font-mono h-8"
                            />
                          </div>
                        ))}
                      </div>
                    </BreakdownSection>

                    {/* Oil Company Methods */}
                    <BreakdownSection label="⛽ Oil Company Fleet Cards">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                          { key: 'hp_pay', label: 'HP' },
                          { key: 'iocl_card', label: 'IOCL' },
                          { key: 'bpcl_smartfleet', label: 'BPCL' },
                          { key: 'essar_fleet', label: 'Essar' },
                          { key: 'reliance_fleet', label: 'Reliance' },
                          { key: 'other_oil_company', label: 'Other' }
                        ].map(({ key, label }) => (
                          <div key={key} className="space-y-1">
                            <Label htmlFor={`oil-${key}`} className="text-xs font-medium">{label}</Label>
                            <Input
                              id={`oil-${key}`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={paymentAllocation.onlineBreakdown?.oilCompany?.[key as OilCompanySubType] || ''}
                              onChange={(e) => {
                                handleUpdateBreakdown(`oilCompany.${key}`, e.target.value);
                                setBreakdownMode('auto');
                              }}
                              placeholder="0.00"
                              className="text-sm font-mono h-8"
                            />
                          </div>
                        ))}
                      </div>
                    </BreakdownSection>

                    {/* Breakdown Summary */}
                    <div className={`p-3 rounded-lg border-2 ${
                      Math.abs(breakdownTotal - toNumber(paymentAllocation.online)) <= 0.01
                        ? 'border-green-300 bg-green-50'
                        : 'border-red-300 bg-red-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">
                          {Math.abs(breakdownTotal - toNumber(paymentAllocation.online)) <= 0.01 ? '✓ Breakdown Matches' : '✗ Breakdown Mismatch'}
                        </span>
                        <span className="font-bold">
                          ₹{safeToFixed(breakdownTotal, 2)} / ₹{safeToFixed(toNumber(paymentAllocation.online), 2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>
        </Tabs>

        {/* Credit Allocations */}
        {nonSampleReadingsCount > 0 && (
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">Credit Payment Allocation</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newCredit: CreditAllocation = { creditorId: '', amount: '' };
                  setPaymentAllocation(prev => ({
                    ...prev,
                    credits: [...prev.credits, newCredit]
                  }));
                }}
                className="gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Credit
              </Button>
            </div>

            {paymentAllocation.credits.length > 0 ? (
              <div className="space-y-3">
                {paymentAllocation.credits.map((credit, index) => {
                  const selectedCreditor = creditors?.find(c => c.id === credit.creditorId);
                  const availableBalance = selectedCreditor 
                    ? selectedCreditor.creditLimit - selectedCreditor.currentBalance 
                    : 0;

                  return (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_0.5fr] gap-3 p-3 border rounded-lg bg-gray-50">
                      <div>
                        <Label className="text-xs font-medium">Creditor</Label>
                        <Select
                          value={credit.creditorId}
                          onValueChange={(value) => {
                            const newCredits = [...paymentAllocation.credits];
                            newCredits[index].creditorId = value;
                            setPaymentAllocation(prev => ({ ...prev, credits: newCredits }));
                          }}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select creditor" />
                          </SelectTrigger>
                          <SelectContent>
                            {creditors?.map((creditor) => (
                              <SelectItem key={creditor.id} value={creditor.id}>
                                {creditor.name} (Available: ₹{safeToFixed(availableBalance, 2)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs font-medium">Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={availableBalance}
                          value={credit.amount}
                          onChange={(e) => {
                            const newCredits = [...paymentAllocation.credits];
                            newCredits[index].amount = e.target.value;
                            setPaymentAllocation(prev => ({ ...prev, credits: newCredits }));
                          }}
                          placeholder="0.00"
                          className="mt-1 font-mono"
                        />
                      </div>

                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newCredits = paymentAllocation.credits.filter((_, i) => i !== index);
                            setPaymentAllocation(prev => ({ ...prev, credits: newCredits }));
                          }}
                          className="w-full text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No credit allocations yet</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Helper component for breakdown sections
 */
function BreakdownSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
      <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
      {children}
    </div>
  );
}

/**
 * Initialize empty breakdown structure
 */
function initializeBreakdown(): PaymentSubBreakdown {
  return {
    cash: 0,
    upi: {},
    card: {},
    oilCompany: {},
    credit: 0
  };
}
