
import React from 'react';
import { Input } from '@/components/ui/input';

export interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  name?: string;
  placeholder?: string;
  className?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, onBlur, disabled, name, placeholder = "₹0.00", className, ...props }, ref) => {
    const formatCurrency = (val: string) => {
      // Remove all non-digit except decimal point
      const cleanValue = val.replace(/[^\d.]/g, '');
      // Only one decimal point
      const parts = cleanValue.split('.');
      if (parts.length > 2) {
        return parts[0] + '.' + parts.slice(1).join('');
      }
      // Limit to 2 decimal places
      if (parts[1] && parts[1].length > 2) {
        return parts[0] + '.' + parts[1].substring(0, 2);
      }
      return cleanValue;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCurrency(e.target.value);
      onChange(formatted);
    };

    // Show Indian Rupees format with ₹, but only if value is not empty
    const displayValue = value ? `₹${value}` : '';

    return (
      <Input
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        name={name}
        placeholder={placeholder}
        className={className}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
