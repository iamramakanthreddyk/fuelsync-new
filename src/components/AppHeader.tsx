
import React from 'react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useFuelPricesData } from '@/hooks/useFuelPricesData';
import FuelSyncLogo from './FuelSyncLogo';
import { MobileMenuTrigger } from './MobileMenuTrigger';
import { FuelPriceCard } from '@/components/dashboard/FuelPriceCard';

/**
 * AppHeader: Header with station name, fuel prices (for station users), and user welcome
 * - Responsive: 
 *   - Mobile: hamburger + title center + fuel prices below (or Station name center)
 *   - Desktop: title left + fuel prices center + welcome message right
 */
export function AppHeader() {
  const { currentStation } = useRoleAccess();
  const { state, isMobile } = useSidebar();
  const { user } = useAuth();
  const { data: fuelPrices, isLoading: isPricesLoading } = useFuelPricesData();

  // Match widths with sidebar (w-20 = 5rem collapsed, w-56 = 14rem expanded)
  const sidebarWidth = state === 'collapsed' ? '5rem' : '14rem';
  const headerStyle: React.CSSProperties = isMobile
    ? { left: 0, width: '100%' }
    : { left: sidebarWidth, width: `calc(100% - ${sidebarWidth})` };

  // Build fuel price object for FuelPriceCard - normalize keys to uppercase
  const fuelPricesObj: Record<string, number> = {};
  if (fuelPrices) {
    fuelPrices.forEach((price) => {
      if (price.price_per_litre !== undefined && price.price_per_litre !== null) {
        const priceValue = parseFloat(String(price.price_per_litre));
        if (!isNaN(priceValue)) {
          fuelPricesObj[price.fuel_type] = priceValue;
        }
      }
    });
  }

  return (
    <header style={headerStyle} className="fixed top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Mobile Header */}
      <div className="md:hidden flex flex-col h-auto min-h-14 px-3 py-1.5 gap-2">
        <div className="flex items-center justify-between gap-2">
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
        
        {/* Fuel Prices on mobile - only show for users with station access */}
        {currentStation && (
          <div className="flex justify-center px-2 pb-1">
            <FuelPriceCard prices={fuelPricesObj} isLoading={isPricesLoading} />
          </div>
        )}
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
        
        {/* Fuel Prices - only show for users with station access */}
        {currentStation && (
          <div className="flex-1 flex justify-center px-4">
            <FuelPriceCard prices={fuelPricesObj} isLoading={isPricesLoading} />
          </div>
        )}
        
        <div className="text-sm text-muted-foreground hidden lg:flex items-center">
          {user?.name && (
            <span>Welcome back, <strong className="text-foreground ml-1">{user.name}</strong> 👋</span>
          )}
        </div>
      </div>
    </header>
  );
}
