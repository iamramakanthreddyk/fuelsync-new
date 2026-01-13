/**
 * ReportHeader Component
 * A gradient header banner for report pages
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface HeaderStat {
  value: string | number;
  label: string;
}

export interface ReportHeaderProps {
  /** Page title */
  title: string;
  /** Page subtitle/description */
  subtitle?: string;
  /** Header icon */
  icon?: LucideIcon;
  /** Stats to display in header */
  stats?: HeaderStat[];
  /** Additional content on the right side */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  stats = [],
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-white border border-slate-200 p-3 md:p-4 text-slate-900 shadow-sm',
        className
      )}
    >
      <div className="relative z-10">
        <div className="flex flex-col gap-3">
          {/* Title and subtitle */}
          <div>
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2 mb-1">
              {Icon && <Icon className="w-5 h-5 md:w-6 md:h-6 text-slate-700" />}
              <span className="truncate">{title}</span>
            </h1>
            {subtitle && (
              <p className="text-slate-600 text-sm leading-tight">{subtitle}</p>
            )}
          </div>

          {/* Stats */}
          {stats.length > 0 && (
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100">
              {stats.map((stat, index) => (
                <div key={index} className="flex-1 text-center">
                  <div className="text-xl md:text-2xl font-bold text-slate-900 mb-1">
                    {stat.value}
                  </div>
                  <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
};

export default ReportHeader;
