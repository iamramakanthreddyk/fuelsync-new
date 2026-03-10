import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Fuel, Calendar } from 'lucide-react';
import { getFuelColors } from '@/lib/fuelColors';
import { toFixedNumber } from '@/lib/numberFormat';

interface FuelPrice {
  id: string;
  fuelType: string;
  price: number | string;
  cost_price?: number | null;
  costPrice?: number | null;
  effectiveFrom: string;
}

interface PriceCardProps {
  price: FuelPrice;
}

export default function PriceCard({ price }: PriceCardProps) {
  const fuelColors = getFuelColors(String(price.fuelType || '').toLowerCase());
  const isEffectiveToday = new Date(price.effectiveFrom) <= new Date();
  const costValue = (price as any).costPrice ?? price.cost_price ?? null;

  return (
    <Card
      className={`relative overflow-hidden border-2 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${fuelColors.border} ${fuelColors.bg}/20`}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 ${fuelColors.dot}`}></div>

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${fuelColors.bg} ${fuelColors.text}`}>
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold capitalize">{price.fuelType}</div>
              <div className="text-xs text-muted-foreground">Fuel Price</div>
            </div>
          </div>
          {!isEffectiveToday && (
            <Badge variant="outline" className="text-xs">
              Upcoming
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Price Display */}
        <div className="text-center">
          <div className={`text-4xl font-bold ${fuelColors.text} mb-1`}>
            ₹{Number(price.price).toFixed(2)}
          </div>
          <p className="text-sm text-muted-foreground">selling price</p>
        </div>

        {/* Cost Price & Profit */}
        {costValue !== null && costValue !== undefined && (
          <div className="bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
            <div className="text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Cost Price:</span>
                <span className="font-medium">₹{Number(costValue).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-600 font-semibold">
                <span>Profit/L:</span>
                <span>₹{toFixedNumber(Number(price.price) - Number(costValue), 2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Effective Date */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            Effective: {new Date(price.effectiveFrom).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </span>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
            isEffectiveToday
              ? 'bg-green-100 text-green-800'
              : 'bg-orange-100 text-orange-800'
          }`}>
            {isEffectiveToday ? '✓ Current' : '○ Upcoming'}
          </div>
        </div>
      </CardContent>

      <div className={`absolute inset-0 bg-gradient-to-br ${fuelColors.bg}/5 pointer-events-none`}></div>
    </Card>
  );
}
