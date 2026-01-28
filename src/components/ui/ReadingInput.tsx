import React, { useRef } from 'react';
import { NumericFormat, NumberFormatValues } from 'react-number-format';


interface ReadingInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const ReadingInput: React.FC<ReadingInputProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = 'Current reading',
  className = ''
}) => {
  // To prevent cursor jumping, pass undefined instead of empty string
  const displayValue = value === '' ? undefined : value;

  // Debounce onChange to avoid premature formatting
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleValueChange = (values: NumberFormatValues) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onChange(values.value);
    }, 400); // 400ms debounce
  };

  return (
    <NumericFormat
      value={displayValue}
      onValueChange={handleValueChange}
      disabled={disabled}
      placeholder={placeholder}
      className={`border border-brand-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition ${className}`}
      allowNegative={true}
      allowLeadingZeros={false}
      decimalScale={4}
      inputMode="decimal"
      autoComplete="off"
      customInput={undefined}
      valueIsNumericString
      thousandSeparator={false}
    />
  );
};
