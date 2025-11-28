
import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataEntryStickyBarProps {
  isDisabled?: boolean;
  label?: string;
  onClick?: () => void;
}

export const DataEntryStickyBar: React.FC<DataEntryStickyBarProps> = ({
  isDisabled,
  label = "Save",
  onClick,
}) => {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 w-full z-30 bg-background/80 backdrop-blur border-t border-muted",
        "flex justify-end px-6 py-3 shadow transition",
      )}
    >
      <Button type="submit" disabled={isDisabled} onClick={onClick}>
        {label}
      </Button>
    </div>
  );
};
