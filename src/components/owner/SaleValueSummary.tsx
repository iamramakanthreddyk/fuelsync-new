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
import { DollarSign, CreditCard } from 'lucide-react';

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

interface PaymentAllocation {
  cash: number;
  online: number;
  credit: number;
  creditorId?: string;
}

interface SaleValueSummaryProps {
  summary: SaleSummaryData;
  paymentAllocation: PaymentAllocation;
  onPaymentChange: (allocation: PaymentAllocation) => void;
  creditors?: Creditor[];
  isLoading?: boolean;
}

export function SaleValueSummary({
  summary,
  paymentAllocation,
  onPaymentChange,
  creditors = [],
  isLoading = false
}: SaleValueSummaryProps) {
  const handleCashChange = (value: number) => {
    onPaymentChange({
      ...paymentAllocation,
      cash: value
    });
  };

  const handleOnlineChange = (value: number) => {
    onPaymentChange({
      ...paymentAllocation,
      online: value
    });
  };

  const handleCreditChange = (value: number) => {
    // Only allow credit if creditor is selected
    if (!paymentAllocation.creditorId && value > 0) {
      return;
    }
    onPaymentChange({
      ...paymentAllocation,
      credit: value
    });
  };

  const handleCreditorChange = (creditorId: string) => {
    onPaymentChange({
      ...paymentAllocation,
      creditorId
    });
  };

  const selectedCreditor = creditors.find(c => c.id === paymentAllocation.creditorId);
  const canAddCredit = paymentAllocation.creditorId && selectedCreditor;
  const creditExceedsLimit = canAddCredit && selectedCreditor && 
    (parseFloat(String(selectedCreditor.currentBalance)) + paymentAllocation.credit) > parseFloat(String(selectedCreditor.creditLimit));

  const allocated = paymentAllocation.cash + paymentAllocation.online + paymentAllocation.credit;
  const remaining = Math.max(0, summary.totalSaleValue - allocated);
  const isBalanced = Math.abs(allocated - summary.totalSaleValue) < 0.01;

  return (
    <Card className={`border-2 ${isBalanced ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
      <CardContent className="p-3 space-y-3">
        {/* Payment Allocation */}
        <div>
          <h4 className="text-xs font-semibold mb-2 text-muted-foreground flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            Payment Allocation
          </h4>

          <div className="space-y-2">
            {/* Cash */}
            <div>
              <Label htmlFor="cash-amount" className="text-xs font-semibold">
                Cash {paymentAllocation.cash > 0 && `₹${safeToFixed(paymentAllocation.cash, 2)}`}
              </Label>
              <Input
                id="cash-amount"
                type="number"
                step="0.01"
                min="0"
                max={summary.totalSaleValue}
                value={paymentAllocation.cash}
                onChange={(e) => handleCashChange(parseFloat(e.target.value) || 0)}
                className="mt-0.5 text-xs h-8 border-green-200 focus:border-green-500"
                disabled={isLoading}
                placeholder="0.00"
              />
            </div>

            {/* Online */}
            <div>
              <Label htmlFor="online-amount" className="text-xs font-semibold">
                Online {paymentAllocation.online > 0 && `₹${safeToFixed(paymentAllocation.online, 2)}`}
              </Label>
              <Input
                id="online-amount"
                type="number"
                step="0.01"
                min="0"
                value={paymentAllocation.online}
                onChange={(e) => handleOnlineChange(parseFloat(e.target.value) || 0)}
                className="mt-0.5 text-xs h-8 border-blue-200 focus:border-blue-500"
                disabled={isLoading}
                placeholder="0.00"
              />
            </div>

            {/* Credit */}
            <div className="space-y-1.5 p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
              <div>
                <Label htmlFor="creditor-select" className="text-xs font-semibold flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  Creditor
                </Label>
                <Select 
                  value={paymentAllocation.creditorId || ''} 
                  onValueChange={handleCreditorChange}
                  disabled={isLoading || creditors.length === 0}
                >
                  <SelectTrigger className="mt-0.5 text-xs h-8 bg-white border-orange-300">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {creditors.length === 0 ? (
                      <SelectItem value="no-creditors" disabled>
                        No creditors
                      </SelectItem>
                    ) : (
                      creditors.map(creditor => (
                        <SelectItem key={creditor.id} value={creditor.id}>
                          <span className="text-xs">
                            {creditor.name} - ₹{safeToFixed(creditor.currentBalance, 0)}/₹{safeToFixed(creditor.creditLimit, 0)}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {paymentAllocation.creditorId && (
                <div>
                  <Label htmlFor="credit-amount" className="text-xs font-semibold">
                    Credit {paymentAllocation.credit > 0 && `₹${safeToFixed(paymentAllocation.credit, 2)}`}
                  </Label>
                  <Input
                    id="credit-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={summary.totalSaleValue}
                    value={paymentAllocation.credit}
                    onChange={(e) => handleCreditChange(parseFloat(e.target.value) || 0)}
                    className={`mt-0.5 text-xs h-8 border-orange-300 focus:border-orange-500 ${creditExceedsLimit ? 'border-red-500 bg-red-50' : ''}`}
                    disabled={isLoading}
                    placeholder="0.00"
                  />
                  {creditExceedsLimit && (
                    <p className="text-xs text-red-600 mt-0.5">⚠ Exceeds limit</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Balance Status */}
        <div className={`p-2.5 rounded border-2 ${isBalanced ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${isBalanced ? 'text-green-700' : 'text-yellow-700'}`}>
              {isBalanced ? '✓ Balanced' : `⚠ ${safeToFixed(remaining, 2)}`}
            </span>
            <div className="text-xs font-bold text-gray-600">
              {safeToFixed(allocated, 0)} / {safeToFixed(summary.totalSaleValue, 0)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
