/**
 * Empty State Component
 * 
 * A flexible component for displaying empty states, no-data messages,
 * and placeholder content.
 * 
 * @module core/components/ui/EmptyState
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Inbox, 
  Search, 
  FileX, 
  AlertCircle,
  Plus,
  RefreshCw,
  LucideIcon
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface EmptyStateProps {
  /** Preset type for common empty states */
  type?: 'empty' | 'no-results' | 'no-data' | 'error' | 'not-found';
  /** Custom icon */
  icon?: LucideIcon | React.ReactNode;
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Additional CSS classes */
  className?: string;
  /** Children to render below the default content */
  children?: React.ReactNode;
}

// ============================================
// PRESETS
// ============================================

interface EmptyStatePreset {
  icon: LucideIcon;
  title: string;
  description: string;
}

const presets: Record<string, EmptyStatePreset> = {
  empty: {
    icon: Inbox,
    title: 'No items yet',
    description: 'Get started by creating your first item.',
  },
  'no-results': {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search or filter criteria.',
  },
  'no-data': {
    icon: FileX,
    title: 'No data available',
    description: 'There is no data to display at the moment.',
  },
  error: {
    icon: AlertCircle,
    title: 'Something went wrong',
    description: 'An error occurred while loading the data.',
  },
  'not-found': {
    icon: FileX,
    title: 'Page not found',
    description: 'The page you are looking for does not exist.',
  },
};

// ============================================
// STYLES
// ============================================

const sizeStyles = {
  sm: {
    container: 'py-6',
    icon: 'h-10 w-10',
    title: 'text-base',
    description: 'text-sm',
  },
  md: {
    container: 'py-12',
    icon: 'h-14 w-14',
    title: 'text-lg',
    description: 'text-sm',
  },
  lg: {
    container: 'py-16',
    icon: 'h-20 w-20',
    title: 'text-xl',
    description: 'text-base',
  },
};

// ============================================
// COMPONENT
// ============================================

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'empty',
  icon,
  title,
  description,
  size = 'md',
  action,
  secondaryAction,
  className,
  children,
}) => {
  const preset = presets[type];
  const styles = sizeStyles[size];

  // Determine which icon to use
  const IconComponent = icon 
    ? (typeof icon === 'function' ? icon : null)
    : preset.icon;
  
  const iconElement = icon && typeof icon !== 'function'
    ? icon
    : IconComponent && <IconComponent className={cn(styles.icon, 'text-muted-foreground/50')} />;

  const displayTitle = title || preset.title;
  const displayDescription = description || preset.description;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        styles.container,
        className
      )}
    >
      {iconElement && (
        <div className="mb-4">{iconElement}</div>
      )}
      
      <h3 className={cn('font-semibold text-foreground', styles.title)}>
        {displayTitle}
      </h3>
      
      <p className={cn('mt-1 max-w-sm text-muted-foreground', styles.description)}>
        {displayDescription}
      </p>

      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action && (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {action.icon ? (
                <action.icon className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {action.label}
            </button>
          )}
          
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}

      {children && <div className="mt-6">{children}</div>}
    </div>
  );
};

// ============================================
// SPECIALIZED EMPTY STATES
// ============================================

/**
 * Search Empty State - for search results
 */
export const SearchEmptyState: React.FC<{
  query?: string;
  onClear?: () => void;
}> = ({ query, onClear }) => (
  <EmptyState
    type="no-results"
    title={query ? `No results for "${query}"` : 'No results found'}
    description="Try adjusting your search terms or filters."
    secondaryAction={
      onClear
        ? { label: 'Clear search', onClick: onClear }
        : undefined
    }
  />
);

/**
 * Error Empty State - for error states
 */
export const ErrorEmptyState: React.FC<{
  error?: string;
  onRetry?: () => void;
}> = ({ error, onRetry }) => (
  <EmptyState
    type="error"
    description={error || 'An error occurred while loading the data.'}
    action={
      onRetry
        ? { label: 'Try again', onClick: onRetry, icon: RefreshCw }
        : undefined
    }
  />
);

/**
 * Table Empty State - for data tables
 */
export const TableEmptyState: React.FC<{
  entity?: string;
  onCreate?: () => void;
}> = ({ entity = 'items', onCreate }) => (
  <EmptyState
    type="empty"
    title={`No ${entity} yet`}
    description={`Get started by creating your first ${entity.replace(/s$/, '')}.`}
    action={
      onCreate
        ? { label: `Add ${entity.replace(/s$/, '')}`, onClick: onCreate }
        : undefined
    }
  />
);
