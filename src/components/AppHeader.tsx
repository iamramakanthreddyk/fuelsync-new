import React, { useEffect } from 'react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useFuelPricesGlobal } from '@/context/FuelPricesContext';
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
  const { prices: globalFuelPrices, setStationId } = useFuelPricesGlobal();
  const isPricesLoading = false;

  useEffect(() => {
    if (currentStation && currentStation.id) {
      setStationId(currentStation.id);
    }
  }, [currentStation, setStationId]);

  // Match widths with sidebar (w-20 = 5rem collapsed, w-64 = 16rem expanded) and account for brand bar (3rem)
  const sidebarWidth = state === 'collapsed' ? '5rem' : '16rem';
  const headerStyle: React.CSSProperties = isMobile
    ? { top: '3rem', left: 0, width: '100%' } // Brand bar is 3rem
    : { top: '3rem', left: sidebarWidth, width: `calc(100% - ${sidebarWidth})` };

  // Build fuel price object for FuelPriceCard - fuel types are already normalized to uppercase
  const fuelPricesObj: Record<string, number> = {};
  if (globalFuelPrices && Object.keys(globalFuelPrices).length > 0) {
    Object.entries(globalFuelPrices).forEach(([fuelType, priceValue]) => {
      const numValue = parseFloat(String(priceValue));
      if (!isNaN(numValue)) {
        fuelPricesObj[fuelType] = numValue; // fuelType is already uppercase from context
      }
    });
  }

  // Employees cannot set fuel prices - only manager and above can
  const canSetPrices = user?.role && ['manager', 'owner', 'super_admin'].includes(user.role);

  return (
    <header style={headerStyle} className="fixed top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Mobile Header - only show when fuel prices are displayed */}
      {currentStation && (
        <div className="md:hidden flex flex-col h-auto min-h-14 px-3 py-1 gap-1">
          {/* Fuel Prices on mobile - only show for users with station access */}
          <div className="flex justify-center px-2 pb-1">
            <FuelPriceCard prices={fuelPricesObj} isLoading={isPricesLoading} canSetPrices={canSetPrices} />
          </div>
        </div>
      )}
    </header>
  );
}
