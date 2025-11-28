/**
 * Loading Spinner Component
 * 
 * A flexible loading indicator with multiple variants.
 * 
 * @module core/components/ui/LoadingSpinner
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Color variant */
  variant?: 'default' | 'primary' | 'secondary' | 'white';
  /** Additional CSS classes */
  className?: string;
  /** Accessible label */
  label?: string;
}

export interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  visible?: boolean;
  /** Loading message */
  message?: string;
  /** Whether to use blur effect */
  blur?: boolean;
  /** Children to render behind the overlay */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export interface SkeletonProps {
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
  /** Shape of the skeleton */
  shape?: 'rectangle' | 'circle' | 'rounded';
  /** Additional CSS classes */
  className?: string;
}

// ============================================
// STYLES
// ============================================

const spinnerSizes = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const spinnerVariants = {
  default: 'text-muted-foreground',
  primary: 'text-primary',
  secondary: 'text-secondary',
  white: 'text-white',
};

// ============================================
// COMPONENTS
// ============================================

/**
 * Loading Spinner component
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  className,
  label = 'Loading...',
}) => {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('inline-flex items-center justify-center', className)}
    >
      <svg
        className={cn(
          'animate-spin',
          spinnerSizes[size],
          spinnerVariants[variant]
        )}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
};

/**
 * Loading Overlay component
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible = true,
  message,
  blur = true,
  children,
  className,
}) => {
  if (!visible && children) {
    return <>{children}</>;
  }

  return (
    <div className={cn('relative', className)}>
      {children}
      {visible && (
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center',
            'bg-background/80 z-50',
            blur && 'backdrop-blur-sm'
          )}
        >
          <LoadingSpinner size="lg" variant="primary" />
          {message && (
            <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Skeleton loader component
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  shape = 'rectangle',
  className,
}) => {
  const shapeClass = {
    rectangle: 'rounded-md',
    circle: 'rounded-full',
    rounded: 'rounded-lg',
  };

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-muted',
        shapeClass[shape],
        className
      )}
      style={style}
    />
  );
};

/**
 * Page Loading component - full page loader
 */
export const PageLoading: React.FC<{ message?: string }> = ({
  message = 'Loading...',
}) => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <LoadingSpinner size="xl" variant="primary" />
      <p className="mt-4 text-lg text-muted-foreground">{message}</p>
    </div>
  );
};

/**
 * Inline Loading component - for inline content
 */
export const InlineLoading: React.FC<{ text?: string }> = ({
  text = 'Loading...',
}) => {
  return (
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <LoadingSpinner size="sm" />
      <span className="text-sm">{text}</span>
    </span>
  );
};

/**
 * Skeleton Text - skeleton loader for text content
 */
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
}> = ({ lines = 3, className }) => {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          width={i === lines - 1 ? '75%' : '100%'}
        />
      ))}
    </div>
  );
};

/**
 * Skeleton Card - skeleton loader for card content
 */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton width={120} height={20} />
          <Skeleton width={180} height={14} />
        </div>
        <Skeleton width={40} height={40} shape="circle" />
      </div>
      <div className="mt-4">
        <SkeletonText lines={2} />
      </div>
    </div>
  );
};
