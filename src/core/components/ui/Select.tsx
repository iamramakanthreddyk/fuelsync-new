/**
 * Select Component
 * 
 * A styled select component with variants and states.
 * 
 * @module core/components/ui/Select
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Select options */
  options: SelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Size variant */
  selectSize?: 'sm' | 'md' | 'lg';
  /** Whether the select has an error */
  hasError?: boolean;
  /** Full width */
  fullWidth?: boolean;
}

// ============================================
// STYLES
// ============================================

const sizeClasses = {
  sm: 'h-8 px-2 text-sm',
  md: 'h-10 px-3 text-sm',
  lg: 'h-12 px-4 text-base',
};

// ============================================
// COMPONENT
// ============================================

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      options,
      placeholder,
      selectSize = 'md',
      hasError = false,
      fullWidth = true,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn('relative', fullWidth && 'w-full')}>
        <select
          className={cn(
            'flex appearance-none rounded-md border border-input bg-background',
            'ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            sizeClasses[selectSize],
            hasError && 'border-destructive focus-visible:ring-destructive',
            fullWidth ? 'w-full' : '',
            'pr-10',
            className
          )}
          disabled={disabled}
          ref={ref}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
    );
  }
);

Select.displayName = 'Select';

// ============================================
// CHECKBOX COMPONENT
// ============================================

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Label text */
  label?: string;
  /** Description text */
  description?: string;
  /** Whether the checkbox has an error */
  hasError?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, hasError, id, ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    if (!label) {
      return (
        <input
          type="checkbox"
          id={checkboxId}
          className={cn(
            'h-4 w-4 rounded border border-input',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            hasError && 'border-destructive',
            className
          )}
          ref={ref}
          {...props}
        />
      );
    }

    return (
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id={checkboxId}
          className={cn(
            'mt-1 h-4 w-4 rounded border border-input',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            hasError && 'border-destructive',
            className
          )}
          ref={ref}
          {...props}
        />
        <div className="grid gap-0.5">
          <label
            htmlFor={checkboxId}
            className="text-sm font-medium leading-none cursor-pointer"
          >
            {label}
          </label>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

// ============================================
// RADIO GROUP COMPONENT
// ============================================

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Radio options */
  options: RadioOption[];
  /** Current value */
  value?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Name attribute */
  name: string;
  /** Direction of options */
  direction?: 'horizontal' | 'vertical';
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  options,
  value,
  onChange,
  name,
  direction = 'vertical',
  className,
  disabled = false,
}) => {
  return (
    <div
      className={cn(
        'flex',
        direction === 'horizontal' ? 'flex-row gap-4' : 'flex-col gap-2',
        className
      )}
      role="radiogroup"
    >
      {options.map((option) => {
        const radioId = `${name}-${option.value}`;
        const isDisabled = disabled || option.disabled;

        return (
          <div key={option.value} className="flex items-start gap-2">
            <input
              type="radio"
              id={radioId}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange?.(option.value)}
              disabled={isDisabled}
              className={cn(
                'mt-1 h-4 w-4 rounded-full border border-input',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            />
            <div className="grid gap-0.5">
              <label
                htmlFor={radioId}
                className={cn(
                  'text-sm font-medium leading-none cursor-pointer',
                  isDisabled && 'cursor-not-allowed opacity-50'
                )}
              >
                {option.label}
              </label>
              {option.description && (
                <p className="text-xs text-muted-foreground">{option.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
