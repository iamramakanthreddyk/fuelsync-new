/**
 * Input Component
 * 
 * A styled input component with variants and states.
 * 
 * @module core/components/ui/Input
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Input variant */
  variant?: 'default' | 'filled' | 'ghost';
  /** Size variant */
  inputSize?: 'sm' | 'md' | 'lg';
  /** Whether the input has an error */
  hasError?: boolean;
  /** Left icon */
  leftIcon?: LucideIcon;
  /** Right icon */
  rightIcon?: LucideIcon;
  /** Full width */
  fullWidth?: boolean;
}

const variantClasses = {
  default: 'border border-input bg-background',
  filled: 'border-0 bg-muted',
  ghost: 'border-0 bg-transparent',
};

const sizeClasses = {
  sm: 'h-8 px-2 text-sm',
  md: 'h-10 px-3 text-sm',
  lg: 'h-12 px-4 text-base',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      variant = 'default',
      inputSize = 'md',
      hasError = false,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      fullWidth = true,
      disabled,
      ...props
    },
    ref
  ) => {
    const hasLeftIcon = Boolean(LeftIcon);
    const hasRightIcon = Boolean(RightIcon);

    const inputElement = (
      <input
        type={type}
        className={cn(
          'flex rounded-md ring-offset-background',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[inputSize],
          hasError && 'border-destructive focus-visible:ring-destructive',
          hasLeftIcon && 'pl-10',
          hasRightIcon && 'pr-10',
          fullWidth ? 'w-full' : '',
          className
        )}
        disabled={disabled}
        ref={ref}
        {...props}
      />
    );

    if (!hasLeftIcon && !hasRightIcon) {
      return inputElement;
    }

    return (
      <div className={cn('relative', fullWidth && 'w-full')}>
        {LeftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <LeftIcon className="h-4 w-4" />
          </div>
        )}
        {inputElement}
        {RightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <RightIcon className="h-4 w-4" />
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/**
 * Textarea Component
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Whether the textarea has an error */
  hasError?: boolean;
  /** Resize behavior */
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError = false, resize = 'vertical', ...props }, ref) => {
    const resizeClasses = {
      none: 'resize-none',
      vertical: 'resize-y',
      horizontal: 'resize-x',
      both: 'resize',
    };

    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          hasError && 'border-destructive focus-visible:ring-destructive',
          resizeClasses[resize],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
