
import React from 'react';
import { Navigate } from 'react-router-dom';
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from '@/hooks/useAuth';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();

  // Superadmins should never see this layout - redirect them
  if (user?.role === 'super_admin') {
    return <Navigate to="/superadmin/users" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-auto pt-20 md:pt-16">
            <div className="w-full px-4 md:px-6 lg:px-8 xl:px-12 pt-6 md:pt-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
