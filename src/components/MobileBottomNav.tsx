import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Zap, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { isOwner, isSuperAdmin, getDashboardUrl, getBasePath } from '@/lib/roleUtils';
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
  Scale3d,
  Droplets,
  PieChart
} from 'lucide-react';

export function MobileBottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isOwnerRole = isOwner(user?.role);
  const isSuper = isSuperAdmin(user?.role);
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
      bgColor: "bg-blue-50",
    },
    {
      title: "Quick Entry",
      url: `${basePath}/quick-entry`,
      icon: Zap,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Stations",
      url: `${basePath}/stations`,
      icon: Building2,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "Reports",
      url: `${basePath}/reports`,
      icon: FileText,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "More",
      url: "#more",
      icon: Menu,
      color: "text-slate-600",
      bgColor: "bg-slate-50",
      isMore: true,
    },
  ] : [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: Home,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Quick Entry",
      url: "/quick-entry",
      icon: Zap,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Sales",
      url: "/sales",
      icon: TrendingUp,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Pumps",
      url: "/pumps",
      icon: Fuel,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "More",
      url: "#more",
      icon: Menu,
      color: "text-slate-600",
      bgColor: "bg-slate-50",
      isMore: true,
    },
  ];

  // If superadmin, override with platform admin items
  const superAdminNavItems = [
    {
      title: 'Users',
      url: '/superadmin/users',
      icon: Users,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Stations',
      url: '/superadmin/stations',
      icon: Building2,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
    {
      title: 'Plans',
      url: '/superadmin/plans',
      icon: Settings,
      color: 'text-slate-700',
      bgColor: 'bg-slate-50',
    },
    {
      title: 'Analytics',
      url: '/superadmin/analytics',
      icon: BarChart3,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
    },
    {
      title: 'More',
      url: '#more',
      icon: Menu,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
      isMore: true,
    },
  ];

  // Additional menu items for the "More" sheet - excluding main nav items
  const additionalMenuItems = isOwnerRole ? [
    {
      title: "Inventory",
      url: `${basePath}/inventory`,
      icon: Droplets,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
    {
      title: "Employees",
      url: `${basePath}/employees`,
      icon: Users,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Daily Settlement",
      url: `${basePath}/stations`,
      icon: Scale3d,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Credit Ledger",
      url: `${basePath}/credit-ledger`,
      icon: Banknote,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
    },
    {
      title: "Daily Reports",
      url: `${basePath}/daily-reports`,
      icon: LineChart,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Analytics",
      url: `${basePath}/analytics`,
      icon: BarChart3,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Income & Receivables",
      url: `${basePath}/income-report`,
      icon: IndianRupee,
      color: "text-teal-600",
      bgColor: "bg-teal-50",
    },
    {
      title: "Profit Reports",
      url: `${basePath}/profit-reports`,
      icon: PieChart,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
      color: "text-slate-600",
      bgColor: "bg-slate-50",
    },
  ] : [
    {
      title: "Inventory",
      url: "/inventory",
      icon: Droplets,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
    ...(isManager ? [
      {
        title: "Stations",
        url: "/stations",
        icon: Building2,
        color: "text-indigo-600",
        bgColor: "bg-indigo-50",
      },
      {
        title: "Staff",
        url: "/staff",
        icon: Users,
        color: "text-orange-600",
        bgColor: "bg-orange-50",
      },
    ] : []),
    {
      title: "Reports",
      url: "/reports",
      icon: FileText,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Profit Reports",
      url: "/profit-reports",
      icon: PieChart,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
      color: "text-slate-600",
      bgColor: "bg-slate-50",
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200/70 shadow-xl">
        {/* Separator line for betteprofit reports not routing to page
        r visual clarity */}
        <div className="h-0.5 bg-gradient-to-r from-transparent via-slate-300/50 to-transparent"></div>
        <div className="flex items-center justify-around h-16 px-1 safe-area-inset-bottom">
          {/* Main Navigation Items */}
          {(isSuper ? superAdminNavItems : mainNavItems).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.url);

            if (item.isMore) {
              return (
                <Sheet key={item.url} open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`flex flex-col items-center justify-center flex-1 py-2 px-0.5 rounded-lg transition-all duration-300 ${
                        active 
                          ? `${item.bgColor} ${item.color} shadow-md scale-105` 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-0.5 transition-all ${item.color}`} />
                      <span className={`text-[10px] font-semibold tracking-wide ${active ? item.color : 'text-slate-700'}`}>
                        {item.title}
                      </span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[82vh] rounded-t-3xl bg-gradient-to-b from-white via-white to-slate-50">
                    <SheetHeader className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white rounded-2xl -mx-6 px-6 py-6 mb-8 shadow-lg">
                      <SheetTitle className="text-left text-white text-xl font-bold tracking-wide">More Options</SheetTitle>
                    </SheetHeader>
                    <div className="grid grid-cols-2 gap-4 mt-6 px-1">
                      {additionalMenuItems.map((menuItem) => {
                        const MenuIcon = menuItem.icon;
                        return (
                          <Link
                            key={menuItem.url}
                            to={menuItem.url}
                            onClick={() => setIsMenuOpen(false)}
                            className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-slate-200 hover:border-slate-300 transition-all duration-300 ${menuItem.bgColor} hover:shadow-2xl hover:scale-110 active:scale-95`}
                          >
                            <MenuIcon className={`w-9 h-9 mb-3 ${menuItem.color}`} />
                            <span className="text-xs font-bold text-center text-slate-800 leading-tight">{menuItem.title}</span>
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
                className={`flex flex-col items-center justify-center flex-1 py-2 px-0.5 rounded-lg transition-all duration-300 ${
                  active
                    ? `${item.bgColor} ${item.color} shadow-md scale-105`
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 transition-all ${item.color}`} />
                <span className={`text-[10px] font-semibold tracking-wide ${active ? item.color : 'text-slate-700'}`}>
                  {item.title}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Safe area padding for devices with home indicator */}
        <div className="h-safe-area-inset-bottom" />
      </div>

    </>
  );
}