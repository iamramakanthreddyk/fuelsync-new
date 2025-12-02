
import React from 'react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import FuelSyncLogo from './FuelSyncLogo';
import { MobileMenuTrigger } from './MobileMenuTrigger';

/**
 * AppHeader: Clean header with only station name (optional), no logo
 * - Responsive: 
 *   - Mobile: hamburger + title center (or Station name center)
 *   - Desktop: title left-aligned (Station name) 
 */
export function AppHeader() {
  const { currentStation } = useRoleAccess();
  const { state, isMobile } = useSidebar();
  const { user } = useAuth();

  // Match widths with sidebar (w-20 = 5rem collapsed, w-56 = 14rem expanded)
  const sidebarWidth = state === 'collapsed' ? '5rem' : '14rem';
  const headerStyle: React.CSSProperties = isMobile
    ? { left: 0, width: '100%' }
    : { left: sidebarWidth, width: `calc(100% - ${sidebarWidth})` };

  return (
    <header style={headerStyle} className="fixed top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center h-14 px-3 py-1.5 justify-between gap-2">
        <MobileMenuTrigger />
        <div className="flex-1 flex items-center justify-center -ml-7">
          {currentStation ? (
            <span className="text-base font-semibold text-foreground truncate text-center flex items-center gap-2">
              <FuelSyncLogo size={24} variant="alt" />
              {currentStation.name}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <FuelSyncLogo size={28} variant="alt" />
              <span className="text-base font-bold text-foreground tracking-wide">FuelSync</span>
            </div>
          )}
        </div>
        <div className="w-8"></div>
      </div>
      {/* Desktop Header */}
      <div className="hidden md:flex items-center h-16 w-full px-6 justify-between">
        <div className="flex items-center gap-3">
          <FuelSyncLogo size={28} variant="alt" />
          {currentStation ? (
            <span className="text-lg font-semibold text-foreground">{currentStation.name}</span>
          ) : (
            <span className="text-lg font-bold text-foreground tracking-wide">FuelSync</span>
          )}
        </div>
        <div className="ml-4 text-sm text-muted-foreground hidden lg:flex items-center">
          {user?.name && (
            <span>Welcome back, <strong className="text-foreground ml-1">{user.name}</strong> 👋</span>
          )}
        </div>
      </div>
    </header>
  );
}
