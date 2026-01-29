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
        'relative overflow-hidden rounded-lg bg-white border border-slate-200 p-4 md:p-6 text-slate-900 shadow-md',
        className
      )}
    >
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div className="flex-1">
            <div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold flex items-center gap-3 mb-1">
                {Icon && <Icon className="w-6 h-6 md:w-7 md:h-7 text-slate-700" />}
                <span className="truncate">{title}</span>
              </h1>
              {subtitle && (
                <p className="text-slate-600 text-sm md:text-base leading-tight">{subtitle}</p>
              )}
            </div>

            {/* Stats */}
            {stats.length > 0 && (
              <div className="flex items-center justify-start gap-4 pt-4">
                {stats.map((stat, index) => (
                  <div key={index} className="flex flex-col items-start">
                    <div className="text-lg md:text-xl font-bold text-slate-900 mb-0">
                      {stat.value}
                    </div>
                    <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right-side actions / children (e.g., last-updated, refresh) */}
          {children && (
            <div className="w-full md:w-auto mt-4 md:mt-0 md:ml-4 flex items-center gap-3 justify-end">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportHeader;
