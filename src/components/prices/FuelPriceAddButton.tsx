
import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface FuelPriceAddButtonProps {
  onAdd: () => void;
  disabled?: boolean;
  isVisible?: boolean;
}
export const FuelPriceAddButton: React.FC<FuelPriceAddButtonProps> = ({
  onAdd,
  disabled,
  isVisible = true,
}) => {
  if (!isVisible) return null;
  return (
    <Button onClick={onAdd} disabled={disabled}>
      <Plus className="w-4 h-4 mr-2" />
      Add Fuel Price
    </Button>
  );
};
