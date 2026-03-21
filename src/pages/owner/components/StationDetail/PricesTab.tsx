import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { useFuelPrices } from '@/hooks/api';
import { unwrapDataOrArray } from '@/lib/api-utils';
import { FuelType, FuelTypeEnum } from '@/core/enums';
import { SetPriceDialog } from './dialogs';
import { PriceCard } from './cards';
import { PermissionGuard } from '@/hooks/usePermissions';
import { toFixedNumber } from '@/lib/numberFormat';
import { formatDateISO } from '@/lib/dateFormat';

interface PricesTabProps {
  id: string;
}

export default function PricesTab({ id }: PricesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [priceForm, setPriceForm] = useState({
    fuelType: FuelTypeEnum.PETROL as FuelType,
    price: '',
    costPrice: '',
    effectiveFrom: formatDateISO(new Date())
  });

  const fuelPricesQuery = useFuelPrices(id);
  const fuelPrices = unwrapDataOrArray(fuelPricesQuery.data, []);
  const fuelPricesLoading = fuelPricesQuery.isLoading;
  const refetch = fuelPricesQuery.refetch;

  const setPriceMutation = useMutation({
    mutationFn: async (data: { fuelType: string; price: string; costPrice?: string; effectiveFrom: string }) => {
      return await apiClient.post(`/stations/${id}/prices`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-prices', id] });
      queryClient.invalidateQueries({ queryKey: ['all-fuel-prices'] });
      refetch();
      toast({ title: 'Success', description: 'Price updated successfully', variant: 'success' });
      setIsPriceDialogOpen(false);
      setPriceForm({ fuelType: FuelTypeEnum.PETROL, price: '', costPrice: '', effectiveFrom: formatDateISO(new Date()) });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to update price';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  });

  const handleSetPrice = () => {
    if (priceForm.costPrice) {
      const costPrice = parseFloat(priceForm.costPrice);
      const price = parseFloat(priceForm.price);
      if (costPrice >= price) {
        toast({
          title: 'Invalid Cost Price',
          description: 'Cost price must be less than selling price',
          variant: 'destructive'
        });
        return;
      }
    }
    
    setPriceMutation.mutate({
      fuelType: priceForm.fuelType,
      price: priceForm.price,
      costPrice: priceForm.costPrice || undefined,
      effectiveFrom: priceForm.effectiveFrom
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Fuel Prices</h2>
          <p className="text-muted-foreground">Current pricing for all fuel types</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['fuel-prices', id] });
              queryClient.invalidateQueries({ queryKey: ['all-fuel-prices'] });
              refetch();
            }}
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <PermissionGuard roles={["manager","owner","super_admin"]} permission="set_prices" fallback={<Button disabled><IndianRupee className="w-4 h-4 mr-2"/>Set Price</Button>}>
            <Button onClick={() => setIsPriceDialogOpen(true)}>
              <IndianRupee className="w-4 h-4 mr-2" />
              Set Price
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {fuelPricesLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading fuel prices...</p>
          </div>
        </div>
      ) : fuelPrices && fuelPrices.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {fuelPrices.map((price) => (
            <PriceCard key={price.id} price={price} />
          ))}
        </div>
      ) : (
        <Card className="border-2 border-dashed border-muted-foreground/25">
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
              <IndianRupee className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Fuel Prices Set</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Set prices for different fuel types to start tracking your station's pricing.
            </p>
            <Button onClick={() => setIsPriceDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Set First Price
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Price Summary */}
      {fuelPrices && fuelPrices.length > 0 && (
        <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Price Summary</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {fuelPrices.length} fuel type{fuelPrices.length > 1 ? 's' : ''} configured
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-green-600">
                    ₹{toFixedNumber(Math.min(...fuelPrices.map(p => parseFloat(String(p.price)))), 2)}
                  </div>
                  <div className="text-muted-foreground">Lowest Price</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-600">
                    ₹{toFixedNumber(fuelPrices.reduce((sum, p) => sum + parseFloat(String(p.price)), 0) / fuelPrices.length, 2)}
                  </div>
                  <div className="text-muted-foreground">Average Price</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-purple-600">
                    ₹{toFixedNumber(Math.max(...fuelPrices.map(p => parseFloat(String(p.price)))), 2)}
                  </div>
                  <div className="text-muted-foreground">Highest Price</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <SetPriceDialog
        open={isPriceDialogOpen}
        onOpenChange={setIsPriceDialogOpen}
        form={priceForm}
        onFormChange={setPriceForm}
        onSubmit={handleSetPrice}
        isLoading={setPriceMutation.isPending}
      />
    </div>
  );
}
