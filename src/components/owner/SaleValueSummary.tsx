
import { Card, CardContent } from '@/components/ui/card';
import { ReadingInput } from '@/components/ui/ReadingInput';
import { Label } from '@/components/ui/label';
import { safeToFixed } from '@/lib/format-utils';
import { toNumber } from '@/utils/number';
import { IndianRupee } from 'lucide-react';
import type { PaymentAllocation, Creditor } from '@/types/finance';

interface SaleSummaryData {
  totalLiters: number;
  totalSaleValue: number;
  byFuelType: Record<string, { liters: number; value: number }>;
}

interface PaymentSummaryCardProps {
  summary: SaleSummaryData;
  paymentAllocation: PaymentAllocation;
  onPaymentChange: (allocation: PaymentAllocation) => void;
  creditors?: Creditor[];
  isLoading?: boolean;
  multiCredit?: boolean;
}

function PaymentInput(props: {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  color?: 'green' | 'blue' | 'orange';
  placeholder?: string;
}) {
  const { id, label, value, onChange, disabled, color = 'green', placeholder = '' } = props;
  const border = color === 'green' ? 'border-green-200 focus:border-green-500' : color === 'blue' ? 'border-blue-200 focus:border-blue-500' : 'border-orange-300 focus:border-orange-500';
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-semibold flex items-center justify-between">
        <span>{label}</span>
      </Label>
      <ReadingInput
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={`mt-0.5 text-xs h-8 w-full ${border}`}
      />
    </div>
  );
}


export function PaymentSummaryCard({
  summary,
  paymentAllocation,
  onPaymentChange,
  creditors = [],
  isLoading = false,
  multiCredit = false
}: PaymentSummaryCardProps) {
  // Always treat cash, online, and credit.amount as strings for input, and only use toNumber for calculations
  const totalCredit = paymentAllocation.credits.reduce((sum, c) => sum + toNumber(String(c.amount)), 0);
  const allocated = toNumber(String(paymentAllocation.cash)) + toNumber(String(paymentAllocation.online)) + totalCredit;
  const remaining = Math.max(0, summary.totalSaleValue - allocated);
  const isBalanced = Math.abs(allocated - summary.totalSaleValue) < 0.01;

  const handleCashChange = (value: string) => {
    onPaymentChange({
      ...paymentAllocation,
      cash: String(value)
    });
  };

  const handleOnlineChange = (value: string) => {
    onPaymentChange({
      ...paymentAllocation,
      online: String(value)
    });
  };

  return (
    <Card className={`border-2 brand-border ${isBalanced ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
      <CardContent className="p-3 space-y-3">
        {/* Payment Allocation */}
        <div>
          <h4 className="text-xs font-semibold mb-2 text-muted-foreground flex items-center gap-1.5 brand-text">
            <IndianRupee className="w-3.5 h-3.5" />
            Payment Allocation
          </h4>
          <div className="space-y-2">
            {/* Cash */}
            <PaymentInput
              id="cash-amount"
              label={`Cash${toNumber(paymentAllocation.cash) > 0 ? ` ₹${toNumber(paymentAllocation.cash) >= 1000 ? `${(toNumber(paymentAllocation.cash) / 1000).toFixed(1)}K` : safeToFixed(toNumber(paymentAllocation.cash), 2)}` : ''}`}
              value={String(paymentAllocation.cash) === '0' ? '' : String(paymentAllocation.cash)}
              onChange={handleCashChange}
              disabled={isLoading}
              color="green"
              placeholder="Cash amount"
            />
            {/* Online */}
            <PaymentInput
              id="online-amount"
              label={`Online${toNumber(paymentAllocation.online) > 0 ? ` ₹${toNumber(paymentAllocation.online) >= 1000 ? `${(toNumber(paymentAllocation.online) / 1000).toFixed(1)}K` : safeToFixed(toNumber(paymentAllocation.online), 2)}` : ''}`}
              value={String(paymentAllocation.online) === '0' ? '' : String(paymentAllocation.online)}
              onChange={handleOnlineChange}
              disabled={isLoading}
              color="blue"
              placeholder="Online amount"
            />
            {/* Credit Allocation */}
            {multiCredit && (
              <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    Credit Allocation
                  </Label>
                  <button
                    type="button"
                    className="text-xs text-orange-600 h-6 px-2 py-1 rounded border border-orange-200 bg-white hover:bg-orange-100"
                    onClick={() => {
                      onPaymentChange({
                        ...paymentAllocation,
                        credits: [...paymentAllocation.credits, { creditorId: '', amount: '' }]
                      });
                    }}
                    disabled={isLoading || !creditors || creditors.length === 0}
                  >
                    + Add
                  </button>
                </div>

                {(!paymentAllocation.credits || paymentAllocation.credits.length === 0) && (
                  <p className="text-xs text-muted-foreground">No credit allocations yet</p>
                )}

                {paymentAllocation.credits && paymentAllocation.credits.map((credit, idx) => (
                  <div key={idx} className="space-y-2 p-2 bg-white border border-orange-100 rounded">
                    <select
                      value={credit.creditorId}
                      onChange={e => {
                        const updated = paymentAllocation.credits.map((c, i) => i === idx ? { ...c, creditorId: e.target.value } : c);
                        onPaymentChange({ ...paymentAllocation, credits: updated });
                      }}
                      disabled={isLoading || !creditors || creditors.length === 0}
                      className="text-xs h-8 bg-white border border-orange-300 w-full rounded"
                    >
                      <option value="">Select creditor...</option>
                      {creditors.map(creditor => (
                        <option key={creditor.id} value={creditor.id}>
                          {creditor.name}{creditor.businessName ? ` (${creditor.businessName})` : ''} - ₹{creditor.currentBalance}/₹{creditor.creditLimit}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <ReadingInput
                        value={credit.amount !== undefined && credit.amount !== null && String(credit.amount) !== '0' ? String(credit.amount) : ''}
                        onChange={v => {
                          const updated = paymentAllocation.credits.map((c, i) => i === idx ? { ...c, amount: String(v) } : c);
                          onPaymentChange({ ...paymentAllocation, credits: updated });
                        }}
                        className="text-xs h-8 border-orange-300 focus:border-orange-500 flex-1"
                        disabled={isLoading}
                        placeholder="Amount"
                      />
                      <button
                        type="button"
                        className="text-xs text-red-500 h-6 w-6 flex items-center justify-center rounded border border-red-200 bg-white hover:bg-red-100"
                        onClick={() => {
                          const updated = paymentAllocation.credits.filter((_, i) => i !== idx);
                          onPaymentChange({ ...paymentAllocation, credits: updated });
                        }}
                        disabled={isLoading}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Balance Status */}
        <div className={`p-2 md:p-2.5 rounded border-2 brand-border ${isBalanced ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
            <span className={`text-xs font-semibold ${isBalanced ? 'text-green-700' : 'text-yellow-700'} brand-text`}>
              {isBalanced ? '✓ Balanced' : `⚠ Unbalanced`}
            </span>
            <div className="text-xs font-bold text-gray-600 text-right sm:text-left whitespace-nowrap overflow-hidden text-ellipsis">
              <span className="inline-block min-w-0">
                {allocated >= 1000 ? `${(allocated / 1000).toFixed(1)}K` : safeToFixed(allocated, 2)}
              </span>
              <span className="mx-1">/</span>
              <span className="inline-block min-w-0">
                {summary.totalSaleValue >= 1000 ? `${(summary.totalSaleValue / 1000).toFixed(1)}K` : safeToFixed(summary.totalSaleValue, 2)}
              </span>
            </div>
          </div>
          {!isBalanced && (
            <div className="text-xs text-yellow-600 mt-1 font-medium">
              Remaining: ₹{safeToFixed(remaining, 2)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { PaymentSummaryCard as SaleValueSummary };
