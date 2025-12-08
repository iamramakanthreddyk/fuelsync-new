import React from 'react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useFuelPricesData, normalizeFuelType } from '@/hooks/useFuelPricesData';
import FuelSyncLogo from './FuelSyncLogo';
import { MobileMenuTrigger } from './MobileMenuTrigger';
import { FuelPriceCard } from '@/components/dashboard/FuelPriceCard';
import { Bell } from 'lucide-react';
import { notificationService } from '@/services/notificationService';

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

  // Build fuel price object for FuelPriceCard - normalize keys to uppercase using enum
  const fuelPricesObj: Record<string, number> = {};
  if (Array.isArray(fuelPrices) && fuelPrices.length > 0) {
    fuelPrices.forEach((price) => {
      // Get price value from any available field
      const priceValue = price.price_per_litre ?? price.pricePerLitre ?? price.price;
      // Get fuel type from any available field and normalize
      const fuelType = price.fuel_type ?? price.fuelType;
      
      if (priceValue !== undefined && priceValue !== null && fuelType) {
        const numValue = parseFloat(String(priceValue));
        if (!isNaN(numValue)) {
          // Use normalizeFuelType to ensure consistent uppercase keys
          fuelPricesObj[normalizeFuelType(fuelType)] = numValue;
        }
      }
    });
  }

  // Notification logic
  const notifications = notificationService.getAll();
  const unreadCount = notificationService.getUnread().length;
  const [showDropdown, setShowDropdown] = React.useState(false);

  return (
    <header style={headerStyle} className="fixed top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Mobile Header */}
      <div className="md:hidden flex flex-col h-auto min-h-14 px-3 py-1.5 gap-2">
        <div className="flex items-center justify-between gap-2">
          <MobileMenuTrigger />
          <div className="flex-1 flex items-center justify-center -ml-7">
            <div className="flex items-center gap-2">
              <FuelSyncLogo size={32} variant="alt" />
              <span className="text-base font-bold text-foreground tracking-wide">FuelSync</span>
            </div>
          </div>
          {/* Notification Bell Mobile - moved to far right */}
          <div className="flex items-center justify-end">
            <div className="relative">
              <button
                className="relative p-2 rounded-full hover:bg-muted transition"
                onClick={() => setShowDropdown((v) => !v)}
                aria-label="Notifications"
              >
                <Bell className="w-6 h-6 text-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-50">
                  <div className="p-3 border-b font-semibold">Notifications</div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-muted-foreground text-center">No notifications</div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={`p-3 border-b last:border-b-0 flex gap-2 items-start ${n.read ? 'bg-muted/30' : ''}`}>
                          <span className={`w-2 h-2 rounded-full mt-2 ${n.type === 'error' ? 'bg-red-500' : n.type === 'warning' ? 'bg-yellow-500' : n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{n.message}</div>
                            <div className="text-xs text-muted-foreground">{n.createdAt.toLocaleString()}</div>
                            {n.link && (
                              <a href={n.link} className="text-xs text-blue-600 underline">View</a>
                            )}
                          </div>
                          {!n.read && (
                            <button
                              className="ml-2 text-xs text-primary underline"
                              onClick={() => { notificationService.markRead(n.id); setShowDropdown(false); }}
                            >Mark read</button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-2 text-right">
                    <button className="text-xs text-muted-foreground underline" onClick={() => { notificationService.clearAll(); setShowDropdown(false); }}>Clear all</button>
                  </div>
                </div>
              )}
            </div>
          </div>
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
          <FuelSyncLogo size={32} variant="alt" />
          <span className="text-lg font-bold text-foreground tracking-wide">FuelSync</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-sm text-muted-foreground hidden lg:flex items-center">
            {user?.name && (
              <span>Welcome back, <strong className="text-foreground ml-1">{user.name}</strong> 👋</span>
            )}
          </div>
          {/* Notification Bell - moved to far right */}
          <div className="relative">
            <button
              className="relative p-2 rounded-full hover:bg-muted transition"
              onClick={() => setShowDropdown((v) => !v)}
              aria-label="Notifications"
            >
              <Bell className="w-6 h-6 text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-50">
                <div className="p-3 border-b font-semibold">Notifications</div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-muted-foreground text-center">No notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`p-3 border-b last:border-b-0 flex gap-2 items-start ${n.read ? 'bg-muted/30' : ''}`}>
                        <span className={`w-2 h-2 rounded-full mt-2 ${n.type === 'error' ? 'bg-red-500' : n.type === 'warning' ? 'bg-yellow-500' : n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{n.message}</div>
                          <div className="text-xs text-muted-foreground">{n.createdAt.toLocaleString()}</div>
                          {n.link && (
                            <a href={n.link} className="text-xs text-blue-600 underline">View</a>
                          )}
                        </div>
                        {!n.read && (
                          <button
                            className="ml-2 text-xs text-primary underline"
                            onClick={() => { notificationService.markRead(n.id); setShowDropdown(false); }}
                          >Mark read</button>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 text-right">
                  <button className="text-xs text-muted-foreground underline" onClick={() => { notificationService.clearAll(); setShowDropdown(false); }}>Clear all</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
