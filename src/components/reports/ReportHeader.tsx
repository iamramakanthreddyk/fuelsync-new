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
        'relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 p-6 md:p-8 text-white shadow-2xl',
        className
      )}
    >
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
              {Icon && <Icon className="w-8 h-8 md:w-10 md:h-10" />}
              {title}
            </h1>
            {subtitle && (
              <p className="text-blue-100 text-base md:text-lg">{subtitle}</p>
            )}
          </div>

          {stats.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 lg:gap-6">
              {stats.map((stat, index) => (
                <React.Fragment key={index}>
                  {index > 0 && (
                    <div className="hidden lg:block w-px h-12 bg-white/20" />
                  )}
                  <div className="text-center lg:text-right">
                    <div className="text-xl md:text-2xl font-bold">
                      {stat.value}
                    </div>
                    <div className="text-blue-200 text-xs md:text-sm">
                      {stat.label}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}

          {children}
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute -top-4 -right-4 w-20 h-20 md:w-24 md:h-24 bg-white/10 rounded-full blur-xl" />
      <div className="absolute -bottom-6 -left-6 w-24 h-24 md:w-32 md:h-32 bg-white/5 rounded-full blur-2xl" />
    </div>
  );
};

export default ReportHeader;
