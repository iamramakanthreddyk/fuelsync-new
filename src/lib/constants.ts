// Shared UI constants and helpers
export const FUEL_TYPE_LABELS: Record<string, string> = {
  PETROL: 'Petrol',
  DIESEL: 'Diesel',
  CNG: 'CNG',
  EV: 'EV Charging',
};

export const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function getSourceBadgeClasses(source?: string) {
  if (!source) return 'bg-gray-100 text-gray-800';
  const s = source.toLowerCase();
  if (s === 'ocr') return 'bg-blue-100 text-blue-700';
  if (s === 'manual') return 'bg-orange-100 text-orange-700';
  if (s === 'tender') return 'bg-green-100 text-green-700';
  if (s === 'refill') return 'bg-purple-100 text-purple-700';
  return 'bg-gray-100 text-gray-800';
}

import { Shield, Home, UserCheck, User, Briefcase, Crown as CrownIcon } from 'lucide-react';

export const ROLE_ICONS: Record<string, any> = {
  super_admin: CrownIcon,
  superadmin: CrownIcon,
  owner: Home,
  manager: Briefcase,
  employee: User,
};
