import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EquipmentStatusEnum, EquipmentStatus } from '@/core/enums';
import { Nozzle } from '@/types/api';

interface EditNozzleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nozzle: Nozzle | null;
  form: { status: EquipmentStatus; notes: string };
  onFormChange: (form: any) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

export default function EditNozzleDialog({ open, onOpenChange, nozzle, form, onFormChange, onSubmit, isLoading }: EditNozzleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Nozzle</DialogTitle>
          <DialogDescription>Update nozzle status for Nozzle {nozzle?.nozzleNumber}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="editNozzleStatus">Status</Label>
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
            <Label htmlFor="editNozzleNotes">Notes</Label>
            <Input
              id="editNozzleNotes"
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
          <Button onClick={onSubmit} disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Update Nozzle'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
