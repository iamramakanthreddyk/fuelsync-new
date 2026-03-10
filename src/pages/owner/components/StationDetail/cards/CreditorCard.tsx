import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, IndianRupee } from 'lucide-react';
import { toFixedNumber } from '@/lib/numberFormat';
import InlineSettleForm from '@/pages/credit/InlineSettleForm';

interface Creditor {
  id: string;
  name: string;
  phone: string;
  email?: string;
  creditLimit: number;
  currentBalance: number;
  vehicleNumber?: string;
}

interface CreditorCardProps {
  creditor: Creditor;
  isSettleOpen: boolean;
  onSettleToggle: () => void;
  onSettleSuccess: () => void;
  stationId: string;
}

export default function CreditorCard({
  creditor,
  isSettleOpen,
  onSettleToggle,
  onSettleSuccess,
  stationId
}: CreditorCardProps) {
  return (
    <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg truncate">
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0" />
              <span className="truncate">{creditor.name}</span>
            </CardTitle>
            <CardDescription className="mt-1 text-xs sm:text-sm truncate">
              {creditor.phone} {creditor.vehicleNumber && `• ${creditor.vehicleNumber}`}
            </CardDescription>
          </div>
          {creditor.currentBalance > 0 && !isSettleOpen && (
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-sm flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3"
              onClick={onSettleToggle}
            >
              <IndianRupee className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden xs:inline">Settle</span>
              <span className="xs:hidden">Pay</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
          <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs sm:text-xs text-muted-foreground font-medium">Credit Limit</p>
            <p className="text-base sm:text-lg font-bold text-blue-600 truncate">₹{toFixedNumber(creditor.creditLimit, 2)}</p>
          </div>
          <div className="text-center p-2 sm:p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-xs sm:text-xs text-muted-foreground font-medium">Outstanding</p>
            <p className="text-base sm:text-lg font-bold text-red-600 truncate">
              ₹{toFixedNumber(creditor.currentBalance, 2)}
            </p>
          </div>
          <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg border border-green-200 col-span-1 sm:col-span-2 lg:col-span-1">
            <p className="text-xs sm:text-xs text-muted-foreground font-medium">Available</p>
            <p className="text-base sm:text-lg font-bold text-green-600 truncate">
              ₹{toFixedNumber(creditor.creditLimit - creditor.currentBalance, 2)}
            </p>
          </div>
        </div>
        {isSettleOpen && (
          <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-orange-50 rounded-lg border border-orange-200">
            <InlineSettleForm
              stationId={stationId}
              creditorId={creditor.id}
              onSuccess={onSettleSuccess}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
