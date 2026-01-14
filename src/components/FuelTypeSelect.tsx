/**
 * Reusable fuel type select component
 * Provides consistent fuel type selection across the application
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FUEL_TYPE_LABELS } from '@/lib/constants';
import { FuelType } from '@/core/enums';

interface FuelTypeSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function FuelTypeSelect({
  value,
  onValueChange,
  placeholder = "Select fuel type",
  className = "",
  disabled = false
}: FuelTypeSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(FUEL_TYPE_LABELS).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}