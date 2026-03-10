import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EquipmentStatusEnum, EquipmentStatus } from '@/core/enums';
import { Pump } from '@/types/api';

interface EditPumpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pump: Pump | null;
  form: { name: string; status: EquipmentStatus; notes: string };
  onFormChange: (form: any) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

export default function EditPumpDialog({ open, onOpenChange, pump, form, onFormChange, onSubmit, isLoading }: EditPumpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Pump</DialogTitle>
          <DialogDescription>Update pump details for {pump?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="editPumpName">Pump Name *</Label>
            <Input
              id="editPumpName"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="editPumpStatus">Status</Label>
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
          <div>
            <Label htmlFor="editPumpNotes">Notes</Label>
            <Input
              id="editPumpNotes"
              value={form.notes}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
              placeholder="Optional notes"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!form.name || isLoading}>
            {isLoading ? 'Updating...' : 'Update Pump'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
