import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Zap, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { isOwner, getDashboardUrl, getBasePath } from '@/lib/roleUtils';
import {
  Building2,
  Users,
  Banknote,
  FileText,
  BarChart3,
  LineChart,
  IndianRupee,
  Settings,
  TrendingUp,
  Fuel,
  Scale3d
} from 'lucide-react';

export function MobileBottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isOwnerRole = isOwner(user?.role);
  const basePath = getBasePath(user?.role);
  const dashboardURL = getDashboardUrl(user?.role);
  const isManager = user?.role === 'manager';

  // Main navigation items for bottom bar - expanded for better UX
  const mainNavItems = isOwnerRole ? [
    {
      title: "Dashboard",
      url: `${basePath}/dashboard`,
      icon: Home,
      color: "text-blue-600",
    },
    {
      title: "Quick Entry",
      url: `${basePath}/quick-entry`,
      icon: Zap,
      color: "text-amber-600",
    },
    {
      title: "Stations",
      url: `${basePath}/stations`,
      icon: Building2,
      color: "text-indigo-600",
    },
    {
      title: "Reports",
      url: `${basePath}/reports`,
      icon: FileText,
      color: "text-green-600",
    },
    {
      title: "More",
      url: "#more",
      icon: Menu,
      color: "text-slate-600",
      isMore: true,
    },
  ] : [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: Home,
      color: "text-blue-600",
    },
    {
      title: "Quick Entry",
      url: "/quick-entry",
      icon: Zap,
      color: "text-amber-600",
    },
    {
      title: "Sales",
      url: "/sales",
      icon: TrendingUp,
      color: "text-yellow-600",
    },
    {
      title: "Pumps",
      url: "/pumps",
      icon: Fuel,
      color: "text-blue-600",
    },
    {
      title: "More",
      url: "#more",
      icon: Menu,
      color: "text-slate-600",
      isMore: true,
    },
  ];

  // Additional menu items for the "More" sheet - excluding main nav items
  const additionalMenuItems = isOwnerRole ? [
    {
      title: "Employees",
      url: `${basePath}/employees`,
      icon: Users,
      color: "text-orange-600",
    },
    {
      title: "Daily Settlement",
      url: `${basePath}/stations`,
      icon: Scale3d,
      color: "text-emerald-600",
    },
    {
      title: "Credit Ledger",
      url: `${basePath}/credit-ledger`,
      icon: Banknote,
      color: "text-pink-600",
    },
    {
      title: "Daily Reports",
      url: `${basePath}/daily-reports`,
      icon: LineChart,
      color: "text-purple-600",
    },
    {
      title: "Analytics",
      url: `${basePath}/analytics`,
      icon: BarChart3,
      color: "text-red-600",
    },
    {
      title: "Income & Receivables",
      url: `${basePath}/income-report`,
      icon: IndianRupee,
      color: "text-teal-600",
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
      color: "text-slate-600",
    },
  ] : [
    ...(isManager ? [
      {
        title: "Stations",
        url: "/stations",
        icon: Building2,
        color: "text-indigo-600",
      },
      {
        title: "Staff",
        url: "/staff",
        icon: Users,
        color: "text-orange-600",
      },
    ] : []),
    {
      title: "Reports",
      url: "/reports",
      icon: FileText,
      color: "text-green-600",
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
      color: "text-slate-600",
    },
  ];

  const isActive = (url: string) => {
    if (url === "#more") return false; // "More" is never active
    if (url === dashboardURL && location.pathname === dashboardURL) return true;
    if (url === '/quick-entry' && location.pathname === '/quick-entry') return true;
    if (url === `${basePath}/quick-entry` && location.pathname === `${basePath}/quick-entry`) return true;
    if (url === '/sales' && location.pathname === '/sales') return true;
    if (url === '/pumps' && location.pathname === '/pumps') return true;
    if (url === '/reports' && location.pathname === '/reports') return true;
    if (url === `${basePath}/reports` && location.pathname === `${basePath}/reports`) return true;
    if (url === `${basePath}/stations` && (location.pathname === `${basePath}/stations` || location.pathname.startsWith(`${basePath}/station/`))) return true;
    if (url === '/stations' && (location.pathname === '/stations' || location.pathname.startsWith('/station/'))) return true;
    return false;
  };

  return (
    <>
      {/* Bottom Navigation Bar - Only visible on mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex items-center justify-around h-16 px-2">
          {/* Main Navigation Items */}
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.url);

            if (item.isMore) {
              return (
                <Sheet key={item.url} open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 ${
                        active ? 'text-blue-600 bg-blue-50' : ''
                      }`}
                    >
                      <Icon className={`w-6 h-6 mb-1 ${active ? item.color : ''}`} />
                      <span className={`text-xs font-medium ${active ? item.color : ''}`}>
                        {item.title}
                      </span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[80vh] rounded-t-xl">
                    <SheetHeader>
                      <SheetTitle className="text-left">More Options</SheetTitle>
                    </SheetHeader>
                    <div className="grid grid-cols-2 gap-3 mt-6">
                      {additionalMenuItems.map((menuItem) => {
                        const MenuIcon = menuItem.icon;
                        return (
                          <Link
                            key={menuItem.url}
                            to={menuItem.url}
                            onClick={() => setIsMenuOpen(false)}
                            className="flex flex-col items-center justify-center p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                          >
                            <MenuIcon className={`w-8 h-8 mb-2 ${menuItem.color}`} />
                            <span className="text-sm font-medium text-center">{menuItem.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </SheetContent>
                </Sheet>
              );
            }

            return (
              <Link
                key={item.url}
                to={item.url}
                className={`flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-lg transition-colors ${
                  active
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className={`w-6 h-6 mb-1 ${active ? item.color : ''}`} />
                <span className={`text-xs font-medium ${active ? item.color : ''}`}>
                  {item.title}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Safe area padding for devices with home indicator */}
        <div className="h-safe-area-inset-bottom bg-white" />
      </div>

    </>
  );
}