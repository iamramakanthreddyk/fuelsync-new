import { Badge } from '@/components/ui/badge';
import { ROLE_ICONS } from '@/lib/constants';

interface RoleBadgeProps {
  role: 'owner' | 'manager' | 'employee' | 'super_admin';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RoleBadge({ role, showLabel = true, size = 'md' }: RoleBadgeProps) {
  const getRoleConfig = () => {
    switch (role) {
      case 'super_admin':
        return {
          icon: ROLE_ICONS.super_admin,
          label: 'Super Admin',
          variant: 'default' as const,
          className: 'bg-gradient-to-r from-red-500 to-pink-600 text-white border-red-600'
        };
      case 'owner':
        return {
          icon: ROLE_ICONS.owner,
          label: 'Owner',
          variant: 'default' as const,
          className: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-yellow-500'
        };
      case 'manager':
        return {
          icon: ROLE_ICONS.manager,
          label: 'Manager',
          variant: 'secondary' as const,
          className: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-blue-600'
        };
      case 'employee':
        return {
          icon: ROLE_ICONS.employee,
          label: 'Employee',
          variant: 'outline' as const,
          className: 'border-gray-400 text-gray-700'
        };
    }
  };

  const config = getRoleConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <Badge variant={config.variant} className={`${config.className} ${sizeClasses[size]} font-medium`}>
      <Icon className={`${iconSizes[size]} mr-1`} />
      {showLabel && config.label}
    </Badge>
  );
}