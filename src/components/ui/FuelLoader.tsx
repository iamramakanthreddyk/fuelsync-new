/**
 * FuelLoader - Animated fuel station themed loading spinner
 * 
 * A visually appealing loader that fits the fuel station theme.
 */

import { cn } from '@/lib/utils';

interface FuelLoaderProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional message to display */
  message?: string;
  /** Full screen overlay mode */
  fullScreen?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24',
};

const textSizes = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

export function FuelLoader({
  size = 'md',
  message,
  fullScreen = false,
  className,
}: FuelLoaderProps) {
  const loader = (
    <div className={cn('flex flex-col items-center justify-center gap-4', className)}>
      {/* Fuel pump icon with animation */}
      <div className={cn('relative', sizeClasses[size])}>
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-4 border-muted" />
        
        {/* Spinning ring */}
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        
        {/* Center fuel drop icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className={cn('text-primary animate-pulse', {
              'h-4 w-4': size === 'sm',
              'h-5 w-5': size === 'md',
              'h-7 w-7': size === 'lg',
              'h-10 w-10': size === 'xl',
            })}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
          </svg>
        </div>
      </div>
      
      {/* Loading message */}
      {message && (
        <p className={cn('text-muted-foreground animate-pulse', textSizes[size])}>
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        {loader}
      </div>
    );
  }

  return loader;
}

/**
 * Simple inline loading spinner
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent',
        className
      )}
    />
  );
}

/**
 * Loading skeleton for cards
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-muted p-4', className)}>
      <div className="h-4 w-3/4 rounded bg-muted-foreground/20 mb-3" />
      <div className="h-3 w-1/2 rounded bg-muted-foreground/20 mb-2" />
      <div className="h-3 w-2/3 rounded bg-muted-foreground/20" />
    </div>
  );
}

/**
 * Loading skeleton for table rows
 */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted-foreground/20" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Page loading state
 */
export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <FuelLoader size="lg" message={message} />
    </div>
  );
}

export default FuelLoader;
