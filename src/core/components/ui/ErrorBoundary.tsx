/**
 * Error Boundary Component
 * 
 * A React error boundary for catching and handling runtime errors.
 * 
 * @module core/components/ui/ErrorBoundary
 */

import React, { Component, ErrorInfo } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface ErrorBoundaryProps {
  /** Children to render */
  children: React.ReactNode;
  /** Custom fallback UI */
  fallback?: React.ReactNode;
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show the error details */
  showDetails?: boolean;
  /** Custom reset handler */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================
// ERROR BOUNDARY COMPONENT
// ============================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): React.ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showDetails = false } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <ErrorFallback
          error={error}
          errorInfo={errorInfo}
          showDetails={showDetails}
          onReset={this.handleReset}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return children;
  }
}

// ============================================
// ERROR FALLBACK COMPONENT
// ============================================

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails?: boolean;
  onReset?: () => void;
  onGoHome?: () => void;
  className?: string;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  showDetails = false,
  onReset,
  onGoHome,
  className,
}) => {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div
      className={cn(
        'flex min-h-[400px] flex-col items-center justify-center p-8 text-center',
        className
      )}
    >
      <div className="mb-4 rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>

      <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
      
      <p className="mb-6 max-w-md text-muted-foreground">
        We're sorry, but something unexpected happened. 
        Please try again or contact support if the problem persists.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onReset && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        )}
        
        {onGoHome && (
          <button
            onClick={onGoHome}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Home className="h-4 w-4" />
            Go to homepage
          </button>
        )}
      </div>

      {(showDetails || isDev) && error && (
        <details className="mt-8 w-full max-w-2xl text-left">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Show error details
          </summary>
          
          <div className="mt-4 space-y-4 rounded-lg border bg-muted/50 p-4">
            <div>
              <h4 className="text-sm font-medium text-destructive">Error Message</h4>
              <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                {error.message}
              </pre>
            </div>

            {error.stack && (
              <div>
                <h4 className="text-sm font-medium text-destructive">Stack Trace</h4>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                  {error.stack}
                </pre>
              </div>
            )}

            {errorInfo?.componentStack && (
              <div>
                <h4 className="text-sm font-medium text-destructive">Component Stack</h4>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                  {errorInfo.componentStack}
                </pre>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
};

// ============================================
// HIGHER-ORDER COMPONENT
// ============================================

/**
 * HOC to wrap a component with an ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `WithErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return WithErrorBoundary;
}

// ============================================
// ASYNC ERROR BOUNDARY (for Suspense)
// ============================================

interface AsyncErrorBoundaryProps extends ErrorBoundaryProps {
  /** Suspense fallback */
  suspenseFallback?: React.ReactNode;
}

export const AsyncErrorBoundary: React.FC<AsyncErrorBoundaryProps> = ({
  children,
  suspenseFallback,
  ...errorBoundaryProps
}) => {
  const defaultSuspenseFallback = (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );

  return (
    <ErrorBoundary {...errorBoundaryProps}>
      <React.Suspense fallback={suspenseFallback || defaultSuspenseFallback}>
        {children}
      </React.Suspense>
    </ErrorBoundary>
  );
};
