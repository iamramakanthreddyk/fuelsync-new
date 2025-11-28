
import React from 'react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { MobileMenuTrigger } from './MobileMenuTrigger';

/**
 * AppHeader: Clean header with only station name (optional), no logo
 * - Responsive: 
 *   - Mobile: hamburger + title center (or Station name center)
 *   - Desktop: title left-aligned (Station name) 
 */
export function AppHeader() {
  const { currentStation } = useRoleAccess();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center h-14 px-3 py-1.5 justify-between gap-2">
        <MobileMenuTrigger />
        <div className="flex-1 flex flex-col items-center justify-center -ml-7">
          {currentStation ? (
            <span className="text-base font-semibold text-foreground truncate text-center">
              {currentStation.name}
            </span>
          ) : (
            <span className="text-base font-bold text-foreground text-center tracking-wide">FuelSync</span>
          )}
        </div>
        <div className="w-8"></div>
      </div>
      {/* Desktop Header */}
      <div className="hidden md:flex items-center h-16 w-full px-6">
        {currentStation ? (
          <span className="text-lg font-semibold text-foreground">{currentStation.name}</span>
        ) : (
          <span className="text-lg font-bold text-foreground tracking-wide">FuelSync</span>
        )}
      </div>
    </header>
  );
}
