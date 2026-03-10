import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FuelTypeSelect } from '@/components/FuelTypeSelect';
import { FuelType } from '@/core/enums';

interface SetPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: { fuelType: FuelType; price: string; costPrice: string; effectiveFrom: string };
  onFormChange: (form: any) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

export default function SetPriceDialog({ open, onOpenChange, form, onFormChange, onSubmit, isLoading }: SetPriceDialogProps) {
  const profit = form.price && form.costPrice ? (parseFloat(form.price) - parseFloat(form.costPrice)).toFixed(2) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Fuel Price</DialogTitle>
          <DialogDescription>Update price for a fuel type</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="fuelType">Fuel Type *</Label>
            <FuelTypeSelect
              value={form.fuelType}
              onValueChange={(value) => onFormChange({ ...form, fuelType: value as FuelType })}
            />
          </div>
          <div>
            <Label htmlFor="price">Selling Price (₹/L) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => onFormChange({ ...form, price: e.target.value })}
              placeholder="105.50"
            />
          </div>
          <div>
            <Label htmlFor="costPrice">Purchase Price (₹/L)</Label>
            <Input
              id="costPrice"
              type="number"
              step="0.01"
              value={form.costPrice}
              onChange={(e) => onFormChange({ ...form, costPrice: e.target.value })}
              placeholder="95.50 (optional)"
            />
            {profit && (
              <div className="mt-2 p-2 bg-green-100 text-green-800 rounded text-sm">
                Profit per liter: ₹{profit}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="effectiveFrom">Effective From *</Label>
            <Input
              id="effectiveFrom"
              type="date"
              value={form.effectiveFrom}
              onChange={(e) => onFormChange({ ...form, effectiveFrom: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!form.price || isLoading}>
            {isLoading ? 'Setting...' : 'Set Price'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
