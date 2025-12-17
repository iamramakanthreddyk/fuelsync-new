/**
 * Sale Value Summary Component - Compact Version
 * Shows payment allocation with minimal whitespace
 */

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { safeToFixed } from '@/lib/format-utils';
 import { IndianRupee, CreditCard } from 'lucide-react';

interface Creditor {
  id: string;
  name: string;
  businessName?: string;
  currentBalance: number;
  creditLimit: number;
}

interface SaleSummaryData {
  totalLiters: number;
  totalSaleValue: number;
  byFuelType: Record<string, { liters: number; value: number }>;
}

interface CreditAllocation {
  creditorId: string;
  amount: number;
}

interface PaymentAllocation {
  cash: number;
  online: number;
  credits: CreditAllocation[];
}

interface SaleValueSummaryProps {
  summary: SaleSummaryData;
  paymentAllocation: PaymentAllocation;
  onPaymentChange: (allocation: PaymentAllocation) => void;
  creditors?: Creditor[];
  isLoading?: boolean;
  multiCredit?: boolean;
}

export function SaleValueSummary(
  {
    summary,
    paymentAllocation,
    onPaymentChange,
    creditors = [],
    isLoading = false,
    multiCredit = false
  }: SaleValueSummaryProps
) {

  const handleCashChange = (value: number | string) => {
    onPaymentChange({
      ...paymentAllocation,
      cash: value === '' ? 0 : Number(value)
    });
  };

  const handleOnlineChange = (value: number | string) => {
    onPaymentChange({
      ...paymentAllocation,
      online: value === '' ? 0 : Number(value)
    });
  };

  // Multi-credit logic
  const handleCreditChange = (idx: number, value: number | string) => {
    const credits = paymentAllocation.credits.map((c, i) => i === idx ? { ...c, amount: value === '' ? 0 : Number(value) } : c);
    onPaymentChange({ ...paymentAllocation, credits });
  };

  const handleCreditorChange = (idx: number, creditorId: string) => {
    const credits = paymentAllocation.credits.map((c, i) => i === idx ? { ...c, creditorId } : c);
    onPaymentChange({ ...paymentAllocation, credits });
  };

  const handleAddCredit = () => {
    onPaymentChange({
      ...paymentAllocation,
      credits: [...paymentAllocation.credits, { creditorId: '', amount: 0 }]
    });
  };

  const handleRemoveCredit = (idx: number) => {
    const credits = paymentAllocation.credits.filter((_, i) => i !== idx);
    onPaymentChange({ ...paymentAllocation, credits });
  };

  const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + c.amount, 0);
  const allocated = paymentAllocation.cash + paymentAllocation.online + totalCredit;
  const remaining = Math.max(0, summary.totalSaleValue - allocated);
  const isBalanced = Math.abs(allocated - summary.totalSaleValue) < 0.01;

  return (
    <Card className={`border-2 ${isBalanced ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
      <CardContent className="p-3 space-y-3">
        {/* Payment Allocation */}
        <div>
          <h4 className="text-xs font-semibold mb-2 text-muted-foreground flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5" />
            Payment Allocation
          </h4>

          <div className="space-y-2">
            {/* Cash */}
            <div>
              <Label htmlFor="cash-amount" className="text-xs font-semibold flex items-center justify-between">
                <span>Cash {paymentAllocation.cash > 0 && `₹${paymentAllocation.cash >= 1000 ? `${(paymentAllocation.cash / 1000).toFixed(1)}K` : safeToFixed(paymentAllocation.cash, 2)}`}</span>
              </Label>
              <Input
                id="cash-amount"
                type="number"
                step="0.01"
                min="0"
                max={summary.totalSaleValue}
                value={paymentAllocation.cash === 0 ? '' : paymentAllocation.cash}
                onChange={(e) => handleCashChange(e.target.value)}
                className="mt-0.5 text-xs h-8 border-green-200 focus:border-green-500"
                disabled={isLoading}
                placeholder="Cash amount"
                inputMode="decimal"
                autoComplete="off"
              />
            </div>

            {/* Online */}
            <div>
              <Label htmlFor="online-amount" className="text-xs font-semibold flex items-center justify-between">
                <span>Online {paymentAllocation.online > 0 && `₹${paymentAllocation.online >= 1000 ? `${(paymentAllocation.online / 1000).toFixed(1)}K` : safeToFixed(paymentAllocation.online, 2)}`}</span>
              </Label>
              <Input
                id="online-amount"
                type="number"
                step="0.01"
                min="0"
                value={paymentAllocation.online === 0 ? '' : paymentAllocation.online}
                onChange={(e) => handleOnlineChange(e.target.value)}
                className="mt-0.5 text-xs h-8 border-blue-200 focus:border-blue-500"
                disabled={isLoading}
                placeholder="Online amount"
                inputMode="decimal"
                autoComplete="off"
              />
            </div>

            {/* Multi-credit allocation - Show as separate rows */}
            {multiCredit && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    Credit Allocations
                  </Label>
                  <button type="button" className="text-xs text-orange-600 font-bold" onClick={handleAddCredit} disabled={isLoading || creditors.length === 0}>
                    + Add
                  </button>
                </div>
                {paymentAllocation.credits.length === 0 && (
                  <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded border">No credit allocations</div>
                )}
                {paymentAllocation.credits.map((credit, idx) => {
                  const selectedCreditor = creditors.find(c => c.id === credit.creditorId);
                  const creditExceedsLimit = selectedCreditor && (parseFloat(String(selectedCreditor.currentBalance)) + credit.amount) > parseFloat(String(selectedCreditor.creditLimit));
                  return (
                    <div key={idx} className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <Select
                            value={credit.creditorId}
                            onValueChange={val => handleCreditorChange(idx, val)}
                            disabled={isLoading || creditors.length === 0}
                          >
                            <SelectTrigger className="text-xs h-8 bg-white border-orange-300 flex-1">
                              <SelectValue placeholder="Select creditor..." />
                            </SelectTrigger>
                            <SelectContent>
                              {creditors.length === 0 ? (
                                <SelectItem value="no-creditors" disabled>
                                  No creditors
                                </SelectItem>
                              ) : (
                                creditors.map(creditor => (
                                  <SelectItem key={creditor.id} value={creditor.id}>
                                    <div className="text-xs">
                                      <div className="font-medium">{creditor.name}</div>
                                      <div className="text-muted-foreground">
                                        Balance: ₹{creditor.currentBalance >= 1000 ? `${(creditor.currentBalance / 1000).toFixed(1)}K` : creditor.currentBalance} / ₹{creditor.creditLimit >= 1000 ? `${(creditor.creditLimit / 1000).toFixed(1)}K` : creditor.creditLimit}
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <button type="button" className="text-xs text-red-500 font-bold px-1" onClick={() => handleRemoveCredit(idx)} disabled={isLoading}>
                            ×
                          </button>
                        </div>
                      </div>
                      {selectedCreditor && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium text-orange-800">{selectedCreditor.name}</span>
                          {selectedCreditor.businessName && (
                            <span className="ml-1">({selectedCreditor.businessName})</span>
                          )}
                        </div>
                      )}
                      <div>
                        <Label htmlFor={`credit-amount-${idx}`} className="text-xs font-semibold flex items-center justify-between">
                          <span>Credit Amount {credit.amount > 0 && `₹${credit.amount >= 1000 ? `${(credit.amount / 1000).toFixed(1)}K` : safeToFixed(credit.amount, 2)}`}</span>
                          {creditExceedsLimit && <span className="text-xs text-red-600">⚠ Exceeds limit</span>}
                        </Label>
                        <Input
                          id={`credit-amount-${idx}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max={summary.totalSaleValue}
                          value={credit.amount === 0 ? '' : credit.amount}
                          onChange={e => handleCreditChange(idx, e.target.value)}
                          className={`mt-0.5 text-xs h-8 border-orange-300 focus:border-orange-500 ${creditExceedsLimit ? 'border-red-500 bg-red-50' : ''}`}
                          disabled={isLoading}
                          placeholder="Credit amount"
                          inputMode="decimal"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Balance Status */}
        <div className={`p-2 md:p-2.5 rounded border-2 ${isBalanced ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
            <span className={`text-xs font-semibold ${isBalanced ? 'text-green-700' : 'text-yellow-700'}`}>
              {isBalanced ? '✓ Balanced' : `⚠ ${safeToFixed(remaining, 2)}`}
            </span>
            <div className="text-xs font-bold text-gray-600 break-all sm:break-normal text-right sm:text-left">
              {allocated >= 1000 ? `${(allocated / 1000).toFixed(1)}K` : allocated} / {summary.totalSaleValue >= 1000 ? `${(summary.totalSaleValue / 1000).toFixed(1)}K` : summary.totalSaleValue}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
