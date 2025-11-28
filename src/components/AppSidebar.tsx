import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { 
  Home, 
  Upload, 
  TrendingUp, 
  Calendar, 
  Fuel, 
  DollarSign, 
  FileText, 
  Users, 
  Building2, 
  Settings,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import FuelSyncLogo from './FuelSyncLogo';
import { useSidebar } from '@/components/ui/sidebar';

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  // This sidebar is ONLY for owners and employees
  // Superadmins should never see this - they have their own layout
  if (user?.role === 'super_admin') {
    return null;
  }

  const menuItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: Home,
    },
    {
      title: "Data Entry",
      url: "/data-entry",
      icon: Upload,
    },
    {
      title: "Sales",
      url: "/sales", 
      icon: TrendingUp,
    },
    {
      title: "Daily Closure",
      url: "/daily-closure",
      icon: Calendar,
    },
    {
      title: "Pumps",
      url: "/pumps",
      icon: Fuel,
    },
    {
      title: "Reports",
      url: "/reports",
      icon: FileText,
    },
  ];

  // Add admin items for owners only
  if (user?.role === 'owner') {
    menuItems.push(
      {
        title: "Manage Users",
        url: "/staff",
        icon: Users,
      },
      {
        title: "My Stations",
        url: "/stations", 
        icon: Building2,
      }
    );
  }

  menuItems.push({
    title: "Settings",
    url: "/settings",
    icon: Settings,
  });

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Helper to close sidebar on mobile when a menu item is clicked
  const handleItemClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar className="w-64">
      <SidebarHeader>
        <Link to="/dashboard">
          <FuelSyncLogo className="h-8" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>FuelSync</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={location.pathname === item.url}
                  >
                    <Link to={item.url} onClick={handleItemClick}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="w-full justify-start"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
        <p className="text-xs text-muted-foreground px-2 pb-2">
          FuelSync &copy; {new Date().getFullYear()}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
