/**
 * Unified Payment Allocation Form Component
 * 
 * Single form design that combines Quick Entry + Detailed Breakdown
 * Benefits:
 * - Single validation pass (no tab syncing issues)
 * - Cleaner state management
 * - Better UX (see all payment options at once)
 * - Easier to maintain and debug
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import type { PaymentAllocation, PaymentSubBreakdown, UpiSubType, CardSubType, OilCompanySubType, Creditor } from '@/types/finance';

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
  // Single state: whether to show breakdown details
  const [showBreakdownDetails, setShowBreakdownDetails] = useState(false);

  // Calculate totals - SINGLE SOURCE OF TRUTH
  const calculateOnlineTotal = (breakdown: PaymentSubBreakdown | null | undefined): number => {
    if (!breakdown) return 0;
    return (
      Object.values(breakdown.upi || {}).reduce((sum, v) => sum + (v || 0), 0) +
      Object.values(breakdown.card || {}).reduce((sum, v) => sum + (v || 0), 0) +
      Object.values(breakdown.oilCompany || {}).reduce((sum, v) => sum + (v || 0), 0)
    );
  };

  const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + toNumber(c.amount), 0);
  const breakdownTotal = calculateOnlineTotal(paymentAllocation.onlineBreakdown);
  
  // Use the greater of online field or calculated breakdown total
  const effectiveOnline = Math.max(toNumber(paymentAllocation.online), breakdownTotal);
  const totalAllocated = toNumber(paymentAllocation.cash) + effectiveOnline + totalCredit;
  const difference = totalAllocated - totalRequired;
  const isMatched = Math.abs(difference) <= 0.01;
  const isShort = difference < -0.01;

  // Auto-sync online field from breakdown when in breakdown mode
  useEffect(() => {
    if (!paymentAllocation.onlineBreakdown || !showBreakdownDetails) return;
    
    const total = calculateOnlineTotal(paymentAllocation.onlineBreakdown);
    if (Math.abs(total - toNumber(paymentAllocation.online)) > 0.01) {
      setPaymentAllocation(prev => ({
        ...prev,
        online: total.toString()
      }));
    }
  }, [paymentAllocation.onlineBreakdown, showBreakdownDetails, paymentAllocation.online, setPaymentAllocation]);

  // Quick fill handlers
  const handleQuickFill = useCallback((method: 'all_cash' | 'equal' | '5050') => {
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
        setShowBreakdownDetails(false);
        break;

      case '5050': {
        const half = totalRequired / 2;
        setPaymentAllocation(prev => ({
          ...prev,
          cash: (Math.round(half * 100) / 100).toString(),
          online: (Math.round(half * 100) / 100).toString(),
          onlineBreakdown: null,
          credits: []
        }));
        setShowBreakdownDetails(false);
        break;
      }

      case 'equal': {
        const third = totalRequired / 3;
        setPaymentAllocation(prev => ({
          ...prev,
          cash: (Math.round(third * 100) / 100).toString(),
          online: (Math.round(third * 100) / 100).toString(),
          onlineBreakdown: null,
          credits: []
        }));
        setShowBreakdownDetails(false);
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

  // Toggle breakdown - auto-initialize if needed
  const handleToggleBreakdown = useCallback((open: boolean) => {
    setShowBreakdownDetails(open);
    if (open && !paymentAllocation.onlineBreakdown) {
      const onlineAmount = toNumber(paymentAllocation.online);
      const breakdown = {
        cash: 0,
        upi: {} as Record<UpiSubType, number>,
        card: {} as Record<CardSubType, number>,
        oilCompany: {} as Record<OilCompanySubType, number>,
        credit: 0
      };
      
      // Pre-fill with sensible defaults if there's an online amount
      if (onlineAmount > 0) {
        const upiAmount = Math.round(onlineAmount * 0.6 * 100) / 100;
        const cardAmount = Math.round(onlineAmount * 0.3 * 100) / 100;
        const oilAmount = Math.round(onlineAmount * 0.1 * 100) / 100;
        
        breakdown.upi = { gpay: upiAmount, phonepe: 0, paytm: 0, amazon_pay: 0, cred: 0, bhim: 0, other_upi: 0 };
        breakdown.card = { debit_card: cardAmount, credit_card: 0 };
        breakdown.oilCompany = { hp_pay: oilAmount, iocl_card: 0, bpcl_smartfleet: 0, essar_fleet: 0, reliance_fleet: 0, other_oil_company: 0 };
      }
      
      setPaymentAllocation(prev => ({
        ...prev,
        onlineBreakdown: breakdown
      }));
    }
  }, [paymentAllocation.onlineBreakdown, paymentAllocation.online, setPaymentAllocation]);

  // Add credit allocation
  const addCredit = useCallback(() => {
    setPaymentAllocation(prev => ({
      ...prev,
      credits: [...prev.credits, { creditorId: '', amount: '0' }]
    }));
  }, [setPaymentAllocation]);

  // Update credit allocation
  const updateCredit = useCallback((index: number, field: 'creditorId' | 'amount', value: string) => {
    setPaymentAllocation(prev => ({
      ...prev,
      credits: prev.credits.map((c, i) => 
        i === index ? { ...c, [field]: value } : c
      )
    }));
  }, [setPaymentAllocation]);

  // Remove credit allocation
  const removeCredit = useCallback((index: number) => {
    setPaymentAllocation(prev => ({
      ...prev,
      credits: prev.credits.filter((_, i) => i !== index)
    }));
  }, [setPaymentAllocation]);

  if (nonSampleReadingsCount === 0) return null;

  return (
    <Card className="shadow-lg border-2">
      <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Payment Allocation</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Status:</span>
            <Badge variant={isMatched ? "default" : isShort ? "destructive" : "secondary"} className="px-3 py-1">
              {isMatched ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Matched
                </>
              ) : isShort ? (
                <>
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Short by ₹{safeToFixed(Math.abs(difference), 2)}
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Over by ₹{safeToFixed(difference, 2)}
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-white p-2 rounded border-l-4 border-blue-500">
            <p className="text-gray-600">Required</p>
            <p className="font-bold text-blue-600">₹{safeToFixed(totalRequired, 2)}</p>
          </div>
          <div className="bg-white p-2 rounded border-l-4 border-green-500">
            <p className="text-gray-600">Allocated</p>
            <p className="font-bold text-green-600">₹{safeToFixed(totalAllocated, 2)}</p>
          </div>
          <div className="bg-white p-2 rounded border-l-4 border-amber-500">
            <p className="text-gray-600">Difference</p>
            <p className={`font-bold ${isMatched ? 'text-green-600' : 'text-red-600'}`}>
              {isMatched ? '✓' : ''} ₹{safeToFixed(Math.abs(difference), 2)}
            </p>
          </div>
          <div className="bg-white p-2 rounded border-l-4 border-purple-500">
            <p className="text-gray-600">Quick Entry</p>
            <p className="text-xs text-purple-600 font-semibold">✓ Recommended</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        
        {/* QUICK ENTRY SECTION - Always Visible */}
        <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-900">Quick Entry</h4>
          <p className="text-sm text-blue-800">Allocate your total payment across these three methods:</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cash */}
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
            </div>

            {/* Online */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                💳 Online Payment
                {paymentAllocation.onlineBreakdown && (
                  <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                    Synced
                  </span>
                )}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={paymentAllocation.online}
                onChange={(e) => setPaymentAllocation(prev => ({ ...prev, online: e.target.value }))}
                placeholder="0.00"
                className="w-full font-mono"
              />
            </div>

            {/* Credit */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">📋 Credit Payment</Label>
              <Input
                type="text"
                value={`₹${safeToFixed(totalCredit, 2)}`}
                disabled
                className="w-full bg-gray-100"
              />
            </div>
          </div>

          {/* Quick Fill Buttons */}
          <div className="bg-white p-3 rounded-lg border border-blue-200">
            <p className="text-xs font-semibold text-blue-900 mb-2">💡 Quick Fill:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickFill('all_cash')}
                className="text-xs"
              >
                All Cash
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickFill('5050')}
                className="text-xs"
              >
                50/50 Split
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickFill('equal')}
                className="text-xs"
              >
                3-Way Split
              </Button>
            </div>
          </div>
        </div>

        {/* BREAKDOWN DETAILS SECTION - Collapsible */}
        {nonSampleReadingsCount > 0 && (
          <Collapsible open={showBreakdownDetails} onOpenChange={handleToggleBreakdown}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between text-base font-semibold border-2"
              >
                <span>💬 Payment Method Breakdown (Optional)</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showBreakdownDetails ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-4 space-y-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
              {paymentAllocation.onlineBreakdown && (
                <div className="space-y-4">
                  <p className="text-sm text-amber-900">
                    <span className="font-semibold">💡 Tip:</span> Break down your online payment (₹{safeToFixed(toNumber(paymentAllocation.online), 2)}) by method. The online field will auto-sync with your total.
                  </p>

                  {/* UPI Methods */}
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold text-gray-900">☎️ UPI Payment Methods</h5>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      {[
                        { key: 'gpay', label: 'Google Pay' },
                        { key: 'phonepe', label: 'PhonePe' },
                        { key: 'paytm', label: 'Paytm' },
                        { key: 'amazon_pay', label: 'Amazon Pay' }
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <Label htmlFor={`upi-${key}`} className="text-xs">{label}</Label>
                          <Input
                            id={`upi-${key}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={paymentAllocation.onlineBreakdown?.upi?.[key as UpiSubType] || ''}
                            onChange={(e) => handleUpdateBreakdown(`upi.${key}`, e.target.value)}
                            placeholder="0"
                            className="text-xs font-mono h-8"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Methods */}
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold text-gray-900">💳 Card Payment Methods</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[
                        { key: 'debit_card', label: 'Debit Card' },
                        { key: 'credit_card', label: 'Credit Card' }
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <Label htmlFor={`card-${key}`} className="text-xs">{label}</Label>
                          <Input
                            id={`card-${key}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={paymentAllocation.onlineBreakdown?.card?.[key as CardSubType] || ''}
                            onChange={(e) => handleUpdateBreakdown(`card.${key}`, e.target.value)}
                            placeholder="0"
                            className="text-xs font-mono h-8"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Oil Company Methods */}
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold text-gray-900">⛽ Oil Company Fleet Cards</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {[
                        { key: 'hp_pay', label: 'HP' },
                        { key: 'iocl_card', label: 'IOCL' },
                        { key: 'bpcl_smartfleet', label: 'BPCL' }
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <Label htmlFor={`oil-${key}`} className="text-xs">{label}</Label>
                          <Input
                            id={`oil-${key}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={paymentAllocation.onlineBreakdown?.oilCompany?.[key as OilCompanySubType] || ''}
                            onChange={(e) => handleUpdateBreakdown(`oilCompany.${key}`, e.target.value)}
                            placeholder="0"
                            className="text-xs font-mono h-8"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Breakdown Summary */}
                  <div className={`p-3 rounded-lg border-2 ${
                    Math.abs(breakdownTotal - toNumber(paymentAllocation.online)) <= 0.01
                      ? 'border-green-300 bg-green-50'
                      : 'border-red-300 bg-red-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        {Math.abs(breakdownTotal - toNumber(paymentAllocation.online)) <= 0.01 
                          ? '✓ Breakdown Matches' 
                          : '✗ Breakdown Mismatch'}
                      </span>
                      <span className="font-bold">
                        ₹{safeToFixed(breakdownTotal, 2)} / ₹{safeToFixed(toNumber(paymentAllocation.online), 2)}
                      </span>
                    </div>
                  </div>

                  {/* Clear Breakdown Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPaymentAllocation(prev => ({
                        ...prev,
                        onlineBreakdown: null
                      }));
                      setShowBreakdownDetails(false);
                    }}
                    className="w-full text-xs text-amber-700 hover:bg-amber-100"
                  >
                    ✕ Clear Breakdown Details
                  </Button>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* CREDIT ALLOCATIONS SECTION */}
        {nonSampleReadingsCount > 0 && (
          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">Credit Payment Allocation</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCredit}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Credit
              </Button>
            </div>

            {paymentAllocation.credits.length === 0 ? (
              <p className="text-sm text-gray-500">No credit allocations yet</p>
            ) : (
              <div className="space-y-3">
                {paymentAllocation.credits.map((credit, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Creditor</Label>
                      <Select value={credit.creditorId} onValueChange={(val) => updateCredit(index, 'creditorId', val)}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select creditor" />
                        </SelectTrigger>
                        <SelectContent>
                          {creditors.map(c => {
                            const availableCredit = c.creditLimit - c.currentBalance;
                            return (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name} (Available: ₹{safeToFixed(availableCredit, 2)})
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={credit.amount}
                        onChange={(e) => updateCredit(index, 'amount', e.target.value)}
                        placeholder="0"
                        className="font-mono text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCredit(index)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
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
