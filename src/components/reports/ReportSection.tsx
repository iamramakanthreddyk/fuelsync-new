/**
 * Report Section Component
 * A reusable wrapper for report content sections with loading, empty, and data states
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReportSectionProps {
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Loading text */
  loadingText?: string;
  /** Whether data is empty */
  isEmpty?: boolean;
  /** Empty state configuration */
  emptyState?: {
    icon: LucideIcon;
    title: string;
    description: string;
  };
  /** CSV export handler */
  onExportCsv?: () => void;
  /** Print/PDF handler */
  onPrintPdf?: () => void;
  /** Children content to render when not loading and not empty */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const ReportSection: React.FC<ReportSectionProps> = ({
  title,
  description,
  isLoading = false,
  loadingText = 'Loading...',
  isEmpty = false,
  emptyState,
  onExportCsv,
  onPrintPdf,
  children,
  className,
}) => {
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {loadingText}
        </div>
      );
    }

    if (isEmpty && emptyState) {
      const EmptyIcon = emptyState.icon;
      return (
        <div className="text-center py-12">
          <EmptyIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{emptyState.title}</h3>
          <p className="text-muted-foreground">{emptyState.description}</p>
        </div>
      );
    }

    return children;
  };

  return (
    <Card className={cn('space-y-4', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <div className="flex items-center gap-2">
            {onExportCsv && (
              <Button variant="outline" size="sm" onClick={onExportCsv}>
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
            )}
            {onPrintPdf && (
              <Button variant="ghost" size="sm" onClick={onPrintPdf}>
                Print/PDF
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
};

export default ReportSection;
