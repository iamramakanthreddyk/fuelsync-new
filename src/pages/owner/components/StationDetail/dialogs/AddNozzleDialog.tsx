import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FuelTypeSelect } from '@/components/FuelTypeSelect';
import { FuelType } from '@/core/enums';
import { Pump } from '@/types/api';

interface AddNozzleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pump: Pump | null;
  form: { fuelType: FuelType; initialReading: string };
  onFormChange: (form: any) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

export default function AddNozzleDialog({ open, onOpenChange, pump, form, onFormChange, onSubmit, isLoading }: AddNozzleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Nozzle</DialogTitle>
          <DialogDescription>Add a new nozzle to {pump?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="nozzleFuelType">Fuel Type *</Label>
            <FuelTypeSelect
              value={form.fuelType}
              onValueChange={(value) => onFormChange({ ...form, fuelType: value as FuelType })}
            />
          </div>
          <div>
            <Label htmlFor="initialReading">Initial Reading *</Label>
            <Input
              id="initialReading"
              type="number"
              step="0.01"
              value={form.initialReading}
              onChange={(e) => onFormChange({ ...form, initialReading: e.target.value })}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!form.initialReading || isLoading}>
            {isLoading ? 'Creating...' : 'Create Nozzle'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
