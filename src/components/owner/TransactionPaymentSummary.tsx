/**
 * Transaction Payment Summary Component
 * Shows payment breakdown for a daily transaction (ONE breakdown for all readings)
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
import { Button } from '@/components/ui/button';
import { safeToFixed } from '@/lib/format-utils';
import { IndianRupee, CreditCard, Trash2 } from 'lucide-react';
import type { Creditor, CreditAllocation } from '@/types/finance';
import { toNumber } from '@/utils/number';
import { ReadingInput } from '@/components/ui/ReadingInput';

interface TransactionPaymentSummaryProps {
  totalSaleValue: number;
  paymentBreakdown: { cash: number; online: number; credit: number };
  onPaymentChange: (breakdown: { cash: number; online: number; credit: number }) => void;
  creditAllocations: CreditAllocation[];
  onCreditAllocationsChange: (allocations: CreditAllocation[]) => void;
  creditors?: Creditor[];
  isLoading?: boolean;
}

export function TransactionPaymentSummary({
  totalSaleValue,
  paymentBreakdown,
  onPaymentChange,
  creditAllocations,
  onCreditAllocationsChange,
  creditors = [],
  isLoading = false
}: TransactionPaymentSummaryProps) {

  const handleCashChange = (value: string | number) => {
    onPaymentChange({ ...paymentBreakdown, cash: toNumber(value) });
  };

  const handleOnlineChange = (value: string | number) => {
    onPaymentChange({ ...paymentBreakdown, online: toNumber(value) });
  };

  const handleCreditChange = (value: string | number) => {
    onPaymentChange({ ...paymentBreakdown, credit: toNumber(value) });
  };

  const handleAddCreditor = () => {
    onCreditAllocationsChange([...creditAllocations, { creditorId: '', amount: 0 }]);
  };

  const handleCreditorChange = (idx: number, creditorId: string) => {
    const updated = creditAllocations.map((c, i) => i === idx ? { ...c, creditorId } : c);
    onCreditAllocationsChange(updated);
  };

  const handleCreditorAmountChange = (idx: number, amount: string | number) => {
    const updated = creditAllocations.map((c, i) => i === idx ? { ...c, amount: toNumber(amount) } : c);
    onCreditAllocationsChange(updated);
  };

  const handleRemoveCreditor = (idx: number) => {
    const updated = creditAllocations.filter((_, i) => i !== idx);
    onCreditAllocationsChange(updated);
  };

  const totalCreditAllocated = creditAllocations.reduce((sum, c) => sum + toNumber(c.amount), 0);
  const allocated = toNumber(paymentBreakdown.cash) + toNumber(paymentBreakdown.online) + toNumber(paymentBreakdown.credit);
  const remaining = Math.max(0, totalSaleValue - allocated);
  const isBalanced = Math.abs(allocated - totalSaleValue) < 0.01;

  return (
    <Card className={`border-2 ${isBalanced ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
      <CardContent className="p-3 space-y-3">
        {/* Title */}
        <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <IndianRupee className="w-3.5 h-3.5" />
          Daily Payment Breakdown
        </h4>

        <div className="space-y-2">
          {/* Cash */}
          <div>
            <Label htmlFor="cash" className="text-xs font-semibold flex items-center justify-between">
              <span>Cash {paymentBreakdown.cash > 0 && `₹${safeToFixed(paymentBreakdown.cash, 2)}`}</span>
            </Label>
            <Input
              id="cash"
              type="number"
              step="0.01"
              min="0"
              max={totalSaleValue}
              value={paymentBreakdown.cash}
              onChange={(e) => handleCashChange(e.target.value)}
              className="mt-0.5 text-xs h-8 border-green-200 focus:border-green-500"
              disabled={isLoading}
              placeholder="0.00"
            />
          </div>

          {/* Online */}
          <div>
            <Label htmlFor="online" className="text-xs font-semibold flex items-center justify-between">
              <span>Online {paymentBreakdown.online > 0 && `₹${safeToFixed(paymentBreakdown.online, 2)}`}</span>
            </Label>
            <Input
              id="online"
              type="number"
              step="0.01"
              min="0"
              max={totalSaleValue}
              value={paymentBreakdown.online}
              onChange={(e) => handleOnlineChange(e.target.value)}
              className="mt-0.5 text-xs h-8 border-blue-200 focus:border-blue-500"
              disabled={isLoading}
              placeholder="0.00"
            />
          </div>

          {/* Credit */}
          <div>
            <Label htmlFor="credit" className="text-xs font-semibold flex items-center justify-between">
              <span>Credit {paymentBreakdown.credit > 0 && `₹${safeToFixed(paymentBreakdown.credit, 2)}`}</span>
            </Label>
            <Input
              id="credit"
              type="number"
              step="0.01"
              min="0"
              max={totalSaleValue}
              value={paymentBreakdown.credit}
              onChange={(e) => handleCreditChange(e.target.value)}
              className="mt-0.5 text-xs h-8 border-orange-200 focus:border-orange-500"
              disabled={isLoading}
              placeholder="0.00"
            />
          </div>

          {/* Credit Allocations */}
          {paymentBreakdown.credit > 0 && (
            <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  Allocate to Creditors
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs text-orange-600 h-6"
                  onClick={handleAddCreditor}
                  disabled={isLoading || creditors.length === 0}
                >
                  + Add
                </Button>
              </div>

              {creditAllocations.length === 0 && (
                <p className="text-xs text-muted-foreground">No creditor allocations yet</p>
              )}

              {creditAllocations.map((credit, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-1">
                  <Select
                    value={credit.creditorId}
                    onValueChange={(val) => handleCreditorChange(idx, val)}
                    disabled={isLoading || creditors.length === 0}
                  >
                    <SelectTrigger className="text-xs h-8 bg-white border-orange-300 min-w-[120px]">
                      <SelectValue placeholder="Select creditor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {creditors.map(creditor => (
                        <SelectItem key={creditor.id} value={creditor.id}>
                          <span className="text-xs">
                            {creditor.name} ({creditor.businessName}) - ₹{creditor.currentBalance}/₹{creditor.creditLimit}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <ReadingInput
                    value={credit.amount === 0 ? '' : String(credit.amount)}
                    onChange={(v: string) => handleCreditorAmountChange(idx, v)}
                    className="text-xs h-8 border-orange-300 focus:border-orange-500"
                    disabled={isLoading}
                    placeholder="Amount"
                  />

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-xs text-red-500 h-6 w-6"
                    onClick={() => handleRemoveCreditor(idx)}
                    disabled={isLoading}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}

              {totalCreditAllocated > 0 && (
                <div className="text-xs text-muted-foreground pt-2 border-t border-orange-200">
                  Allocated: ₹{safeToFixed(totalCreditAllocated, 2)} / ₹{safeToFixed(paymentBreakdown.credit, 2)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Balance Status */}
        <div className={`p-2 md:p-2.5 rounded border-2 ${isBalanced ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
            <span className={`text-xs font-semibold ${isBalanced ? 'text-green-700' : 'text-yellow-700'}`}>
              {isBalanced ? '✓ Balanced' : `⚠ ₹${safeToFixed(remaining, 2)} remaining`}
            </span>
            <div className="text-xs font-bold text-gray-600">
              ₹{safeToFixed(allocated, 2)} / ₹{safeToFixed(totalSaleValue, 2)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
