/**
 * GlobalFilterContext
 * Manages app-wide date range filter that can be used by all pages
 * Provides consistent date filtering across Reports, Expenses, and other daterange-based pages
 */

import React, { createContext, useContext, useState, useMemo } from 'react';

interface GlobalFilterContextType {
  /** Start date in YYYY-MM-DD format */
  startDate: string;
  /** End date in YYYY-MM-DD format */
  endDate: string;
  /** Set the date range */
  setDateRange: (start: string, end: string) => void;
  /** Preset: Last N days */
  setLastNDays: (days: number) => void;
  /** Preset: This month */
  setThisMonth: () => void;
  /** Preset: Last month */
  setLastMonth: () => void;
}

export const GlobalFilterContext = createContext<GlobalFilterContextType | undefined>(undefined);

interface GlobalFilterProviderProps {
  children: React.ReactNode;
}

export const GlobalFilterProvider: React.FC<GlobalFilterProviderProps> = ({ children }) => {
  // Default: Last 30 days
  const getDefaultDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  };

  const [startDate, setStartDate] = useState(getDefaultDates().startDate);
  const [endDate, setEndDate] = useState(getDefaultDates().endDate);

  const value: GlobalFilterContextType = useMemo(
    () => ({
      startDate,
      endDate,
      setDateRange: (start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
      },
      setLastNDays: (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
      },
      setThisMonth: () => {
        const end = new Date();
        const start = new Date(end.getFullYear(), end.getMonth(), 1);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
      },
      setLastMonth: () => {
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1);
        const start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        const end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
      },
    }),
    [startDate, endDate]
  );

  return (
    <GlobalFilterContext.Provider value={value}>
      {children}
    </GlobalFilterContext.Provider>
  );
};

/**
 * Hook to use global filter context
 */
export const useGlobalFilter = (): GlobalFilterContextType => {
  const context = useContext(GlobalFilterContext);
  if (!context) {
    throw new Error('useGlobalFilter must be used within GlobalFilterProvider');
  }
  return context;
};
