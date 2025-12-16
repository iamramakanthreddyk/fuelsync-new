/**
 * PaymentSplit Component
 * 
 * Allows users to split a sale amount between cash, online, and credit.
 * Auto-calculates online amount when cash is entered.
 * 
 * Usage:
 * <PaymentSplit
 *   totalAmount={5073.75}
 *   onPaymentChange={(split) => console.log(split)}
 * />
 */

import { useState, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Banknote, CreditCard, Smartphone, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PaymentSplitData {
  cash: number;
  online: number;  // UPI + Card combined
  credit: number;
  total: number;
  isBalanced: boolean;
}

export interface PaymentBreakdown {
  cash: number;
  online: number;
  credit: number;
}

interface PaymentSplitProps {
  totalAmount: number;
  disabled?: boolean;
  onPaymentChange: (split: PaymentSplitData & { paymentBreakdown: PaymentBreakdown }) => void;
  initialCash?: number;
  showCredit?: boolean;
  className?: string;
}

export function PaymentSplit({
  totalAmount,
  disabled = false,
  onPaymentChange,
  initialCash,
  showCredit = false,
  className
}: PaymentSplitProps) {
  // Default cash to total amount (most common case)
  const [cashAmount, setCashAmount] = useState<string>(
    initialCash !== undefined ? initialCash.toFixed(2) : totalAmount.toFixed(2)
  );
  const [creditAmount, setCreditAmount] = useState<string>('0');
  
  // Calculate online as remainder
  const cash = parseFloat(cashAmount) || 0;
  const credit = parseFloat(creditAmount) || 0;
  const online = Math.max(0, totalAmount - cash - credit);
  const actualTotal = cash + online + credit;
  const isBalanced = Math.abs(actualTotal - totalAmount) < 0.01;
  
  // Notify parent of changes
  const notifyChange = useCallback(() => {
    onPaymentChange({
      cash,
      online,
      credit,
      total: actualTotal,
      isBalanced,
      paymentBreakdown: { cash, online, credit }
    });
  }, [cash, online, credit, actualTotal, isBalanced, onPaymentChange]);

  useEffect(() => {
    notifyChange();
  }, [notifyChange]);

  // Reset when total changes
  useEffect(() => {
    if (initialCash === undefined) {
      setCashAmount(totalAmount.toFixed(2));
      setCreditAmount('0');
    }
  }, [totalAmount, initialCash]);

  const handleCashChange = (value: string) => {
    // Allow empty input for better UX
    if (value === '') {
      setCashAmount('');
      return;
    }
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      // Don't allow cash to exceed total - credit
      const maxCash = totalAmount - credit;
      const clampedValue = Math.min(numValue, maxCash);
      setCashAmount(clampedValue.toFixed(2));
    }
  };

  const handleCreditChange = (value: string) => {
    if (value === '') {
      setCreditAmount('');
      return;
    }
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      // Don't allow credit to exceed total
      const clampedValue = Math.min(numValue, totalAmount);
      setCreditAmount(clampedValue.toFixed(2));
      
      // Adjust cash if needed
      if (cash + clampedValue > totalAmount) {
        setCashAmount((totalAmount - clampedValue).toFixed(2));
      }
    }
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;

  if (totalAmount <= 0) {
    return null;
  }

  return (
    <Card className={cn("border-2", isBalanced ? "border-green-200" : "border-yellow-200", className)}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Banknote className="w-4 h-4 text-green-600" />
            Payment Collection
          </h4>
          {isBalanced ? (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Balanced
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
              <AlertCircle className="w-3 h-3 mr-1" />
              Check amounts
            </Badge>
          )}
        </div>

        {/* Total Sale Display */}
        <div className="bg-gradient-to-r from-primary/10 to-blue-50 dark:from-primary/20 dark:to-blue-950/20 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Total Sale Value</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totalAmount)}</p>
        </div>

        {/* Payment Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cash Input */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Banknote className="w-4 h-4 text-green-600" />
              Cash Received
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={totalAmount - credit}
                value={cashAmount}
                onChange={(e) => handleCashChange(e.target.value)}
                onBlur={() => {
                  if (cashAmount === '') setCashAmount('0');
                }}
                disabled={disabled}
                className="pl-7 font-medium"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter actual cash collected
            </p>
          </div>

          {/* Online/Card (Auto-calculated) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <CreditCard className="w-3 h-3 text-purple-600" />
              </div>
              Online / Card
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <Input
                type="text"
                value={formatCurrency(online).replace('₹', '')}
                disabled
                className="pl-7 font-medium bg-muted/50"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Auto-calculated remainder
            </p>
          </div>
        </div>

        {/* Credit (Optional) */}
        {showCredit && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-orange-600" />
              Credit Given
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={totalAmount}
                value={creditAmount}
                onChange={(e) => handleCreditChange(e.target.value)}
                onBlur={() => {
                  if (creditAmount === '') setCreditAmount('0');
                }}
                disabled={disabled}
                className="pl-7 font-medium"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Amount on credit (will be collected later)
            </p>
          </div>
        )}

        {/* Summary */}
        <div className="border-t pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Cash:</span>
            <span className="font-medium text-green-600">{formatCurrency(cash)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Online/Card:</span>
            <span className="font-medium text-blue-600">{formatCurrency(online)}</span>
          </div>
          {showCredit && credit > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Credit:</span>
              <span className="font-medium text-orange-600">{formatCurrency(credit)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t pt-1">
            <span>Total:</span>
            <span className={isBalanced ? "text-green-600" : "text-yellow-600"}>
              {formatCurrency(actualTotal)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PaymentSplit;
