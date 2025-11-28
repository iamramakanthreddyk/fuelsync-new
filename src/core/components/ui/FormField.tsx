/**
 * Form Field Component
 * 
 * A wrapper component for form inputs with label, error, and helper text.
 * 
 * @module core/components/ui/FormField
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface FormFieldProps {
  /** Field label */
  label?: string;
  /** Field name/id */
  name?: string;
  /** Helper text below the input */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Children (the input element) */
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  helperText,
  error,
  required = false,
  disabled = false,
  className,
  children,
}) => {
  const hasError = Boolean(error);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={name}
          className={cn(
            'text-sm font-medium leading-none',
            disabled && 'text-muted-foreground cursor-not-allowed',
            hasError && 'text-destructive'
          )}
        >
          {label}
          {required && (
            <span className="ml-1 text-destructive" aria-hidden="true">*</span>
          )}
        </label>
      )}

      <div className="relative">
        {children}
      </div>

      {(helperText || error) && (
        <p
          className={cn(
            'text-xs',
            hasError ? 'text-destructive' : 'text-muted-foreground'
          )}
          role={hasError ? 'alert' : undefined}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
};

/**
 * Form Section - groups related form fields
 */
export interface FormSectionProps {
  /** Section title */
  title?: string;
  /** Section description */
  description?: string;
  /** Children */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
  className,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-lg font-medium">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
};

/**
 * Form Actions - container for form submit/cancel buttons
 */
export interface FormActionsProps {
  /** Alignment of buttons */
  align?: 'left' | 'center' | 'right' | 'between';
  /** Children */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const FormActions: React.FC<FormActionsProps> = ({
  align = 'right',
  children,
  className,
}) => {
  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div className={cn('flex items-center gap-3 pt-4', alignmentClasses[align], className)}>
      {children}
    </div>
  );
};
