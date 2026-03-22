/**
 * Owner Dashboard Navigation Configuration
 * Single source of truth for all navigation items
 * Eliminates duplication between QuickEntryCardsGrid and QuickActions
 */

import {
  Zap,
  Clock,
  Building2,
  Calculator,
  BarChart3,
  Fuel,
  Settings,
  LucideIcon
} from 'lucide-react';

export interface NavigationItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;      // bg color
  textColor: string;  // text color
  roles: ('owner' | 'manager' | 'admin' | 'employee')[]; // who can see it
  section?: 'primary' | 'admin' | 'secondary'; // for grouping
}

export const OWNER_NAVIGATION: NavigationItem[] = [
  // PRIMARY ACTIONS (top row)
  {
    id: 'quick-entry',
    title: 'Quick Entry',
    description: 'Fast readings',
    href: '/owner/quick-entry',
    icon: Zap,
    color: 'bg-yellow-500 hover:bg-yellow-600',
    textColor: 'text-yellow-50',
    roles: ['owner', 'manager'],
    section: 'primary'
  },
  {
    id: 'settlement',
    title: 'Daily Settlement',
    description: 'End of day close',
    href: '/settlements',
    icon: Calculator,
    color: 'bg-green-500 hover:bg-green-600',
    textColor: 'text-green-50',
    roles: ['owner', 'manager'],
    section: 'primary'
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Sales & analytics',
    href: '/reports',
    icon: BarChart3,
    color: 'bg-purple-500 hover:bg-purple-600',
    textColor: 'text-purple-50',
    roles: ['owner', 'manager'],
    section: 'primary'
  },

  // ADMIN ACTIONS
  {
    id: 'shifts',
    title: 'Shifts',
    description: 'Team management',
    href: '/owner/shifts',
    icon: Clock,
    color: 'bg-orange-500 hover:bg-orange-600',
    textColor: 'text-orange-50',
    roles: ['owner'],
    section: 'admin'
  },
  {
    id: 'stations',
    title: 'Stations',
    description: 'Manage locations',
    href: '/owner/stations',
    icon: Building2,
    color: 'bg-blue-500 hover:bg-blue-600',
    textColor: 'text-blue-50',
    roles: ['owner'],
    section: 'admin'
  },
  {
    id: 'fuel-prices',
    title: 'Fuel Prices',
    description: 'Update rates',
    href: '/prices',
    icon: Fuel,
    color: 'bg-amber-500 hover:bg-amber-600',
    textColor: 'text-amber-50',
    roles: ['owner'],
    section: 'admin'
  },

  // SECONDARY ACTIONS
  {
    id: 'settings',
    title: 'Settings',
    description: 'Preferences',
    href: '/settings',
    icon: Settings,
    color: 'bg-gray-500 hover:bg-gray-600',
    textColor: 'text-gray-50',
    roles: ['owner', 'manager', 'employee'],
    section: 'secondary'
  }
];

/**
 * Filter navigation items by user role
 */
export function getNavigationForRole(
  role: 'owner' | 'manager' | 'admin' | 'employee' | undefined
): NavigationItem[] {
  if (!role) return [];
  return OWNER_NAVIGATION.filter(item => item.roles.includes(role));
}

/**
 * Get items by section
 */
export function getNavigationBySection(
  role: 'owner' | 'manager' | 'admin' | 'employee' | undefined,
  section: 'primary' | 'admin' | 'secondary'
): NavigationItem[] {
  return getNavigationForRole(role).filter(item => item.section === section);
}
