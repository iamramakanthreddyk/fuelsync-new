
import { useAuth } from './useAuth';
import { useMemo } from 'react';

type UserRole = 'super_admin' | 'superadmin' | 'owner' | 'manager' | 'employee';

export interface StationAccess {
  id: string;
  name: string;
  brand: string;
  address: string | null;
}

export interface RoleAccess {
  role: UserRole;
  canAccessAllStations: boolean;
  stations: StationAccess[];
  currentStation: StationAccess | null;
  isAdmin: boolean;
  isOwner: boolean;
  isManager: boolean;
  isEmployee: boolean;
}

export function useRoleAccess(): RoleAccess {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) {
      return {
        role: 'employee' as UserRole,
        canAccessAllStations: false,
        stations: [],
        currentStation: null,
        isAdmin: false,
        isOwner: false,
        isManager: false,
        isEmployee: true,
      };
    }

    const role = user.role;
    const stations = user.stations || [];
    
    return {
      role,
      canAccessAllStations: role === 'super_admin',
      stations,
      currentStation: stations[0] || null,
      isAdmin: role === 'super_admin',
      isOwner: role === 'owner',
      isManager: role === 'manager',
      isEmployee: role === 'employee',
    };
  }, [user]);
}
