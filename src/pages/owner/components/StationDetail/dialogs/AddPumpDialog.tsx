import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EquipmentStatusEnum, EquipmentStatus } from '@/core/enums';

interface AddPumpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: { pumpNumber: string; name: string; status: EquipmentStatus };
  onFormChange: (form: any) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

export default function AddPumpDialog({ open, onOpenChange, form, onFormChange, onSubmit, isLoading }: AddPumpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Pump</DialogTitle>
          <DialogDescription>Create a new pump for this station</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="pumpName">Pump Name *</Label>
            <Input
              id="pumpName"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder="e.g., Main Pump"
            />
          </div>
          <div>
            <Label htmlFor="pumpStatus">Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) => onFormChange({ ...form, status: value as EquipmentStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EquipmentStatusEnum.ACTIVE}>Active</SelectItem>
                <SelectItem value={EquipmentStatusEnum.INACTIVE}>Inactive</SelectItem>
                <SelectItem value={EquipmentStatusEnum.MAINTENANCE}>Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!form.name || isLoading}>
            {isLoading ? 'Creating...' : 'Create Pump'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
