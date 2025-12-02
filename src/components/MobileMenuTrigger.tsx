
import React from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';

export function MobileMenuTrigger() {
  const { toggleSidebar, setOpenMobile } = useSidebar();

  const openMobile = () => {
    // prefer explicitly opening the mobile sheet so behavior is consistent
    if (setOpenMobile) setOpenMobile(true)
    else toggleSidebar()
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="md:hidden"
      onClick={openMobile}
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">Toggle menu</span>
    </Button>
  );
}
