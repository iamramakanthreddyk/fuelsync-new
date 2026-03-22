/**
 * QuickEntryCardsGrid - Quick action cards for navigation
 * Displays cards for Quick Entry, Settlement, Reports, Shifts, Stations
 * Consolidated from navigationConfig to avoid duplication
 */

import { Card, CardContent } from '@/components/ui/card';
import { NavigateFunction } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getNavigationBySection } from '@/utils/navigationConfig';

interface QuickEntryCardsGridProps {
  navigate: NavigateFunction;
}

export function QuickEntryCardsGrid({ navigate }: QuickEntryCardsGridProps) {
  const { user } = useAuth();

  // Get primary and admin navigation items based on role - excluding secondary/settings
  const primaryItems = getNavigationBySection(user?.role, 'primary');
  const adminItems = getNavigationBySection(user?.role, 'admin');
  const cardItems = [...primaryItems, ...adminItems];

  return (
    <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {cardItems.map((item) => {
        const IconComponent = item.icon;
        // Extract color name for background styling (e.g., 'bg-yellow-500' -> 'yellow')
        const colorMatch = item.color.match(/-([\w]+)-/);
        const colorName = colorMatch ? colorMatch[1] : 'gray';
        
        return (
          <Card 
            key={item.id}
            className={`group cursor-pointer hover:shadow-lg transition-all duration-200 border hover:border-${colorName}-500/50 bg-gradient-to-br from-${colorName}-50/30 to-transparent`}
            onClick={() => navigate(item.href)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate(item.href)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 bg-${colorName}-100 rounded-md group-hover:scale-110 transition-transform`}>
                  <IconComponent className={`w-4 h-4 text-${colorName}-600`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-semibold text-gray-900 group-hover:text-${colorName}-700`}>
                    {item.title}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {item.description}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
