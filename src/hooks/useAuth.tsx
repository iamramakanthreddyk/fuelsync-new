import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useMemo } from 'react';
import { apiClient, getToken, setToken, removeToken, getStoredUser, setStoredUser, ApiError } from '@/lib/api-client';

// ============================================
// TYPES
// ============================================

export type UserRole = 'super_admin' | 'superadmin' | 'owner' | 'manager' | 'employee';

export interface User {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  stations: Array<{
    id: string;
    name: string;
    brand: string;
    address: string | null;
  }>;
  plan?: {
    name: string;
    maxStations: number;
    maxPumpsPerStation: number;
  };
}

interface AuthContextType {
  user: User | null;
  session: { access_token: string } | null;
  loading: boolean;
  isLoading: boolean;  // Alias for loading
  isLoggedIn: boolean;
  isAuthenticated: boolean; // Alias for isLoggedIn
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (user: User) => void;
}

// ============================================
// ROLE HIERARCHY
// ============================================

const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  superadmin: 100,
  owner: 75,
  manager: 50,
  employee: 25,
};

// ============================================
// CONTEXT
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const token = getToken();
  const session = token ? { access_token: token } : null;
  const isLoggedIn = !!user && !!token;

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = getToken();
        const storedUser = getStoredUser<User>();
        
        if (storedToken && storedUser) {
          setUser(storedUser);
          // Verify token is still valid
          await verifyToken();
        }
      } catch (error) {
        console.error('[AUTH] Init error:', error);
        removeToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Verify token with backend
  const verifyToken = useCallback(async () => {
    try {
      const response = await apiClient.get<{ success: boolean; data: User }>('/auth/me');
      if (response.success && response.data) {
        const userData = {
          ...response.data,
          stations: response.data.stations || [],
        };
        setUser(userData);
        setStoredUser(userData);
      }
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        removeToken();
        setUser(null);
      }
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await apiClient.post<{ 
        success: boolean; 
        data: { token: string; user: User } 
      }>('/auth/login', { email, password });
      
      if (!response.success || !response.data) {
        throw new Error('Login failed');
      }

      const { token: authToken, user: authUser } = response.data;
      
      // Store credentials
      setToken(authToken);
      const userData = {
        ...authUser,
        stations: authUser.stations || [],
      };
      setStoredUser(userData);
      setUser(userData);

      console.log('[AUTH] Login successful:', authUser.email, authUser.role);
    } catch (error: any) {
      console.error('[AUTH] Login error:', error);
      if (error.message?.includes('Invalid credentials') || error.statusCode === 401) {
        throw new Error('Invalid credentials');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Call logout endpoint (fire and forget)
      apiClient.post('/auth/logout').catch(() => {});
    } finally {
      // Clear local state
      removeToken();
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    setStoredUser(updatedUser);
  }, []);

  // Memoize context value
  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    loading,
    isLoading: loading,
    isLoggedIn,
    isAuthenticated: isLoggedIn,
    login,
    logout,
    signOut: logout,
    updateUser,
  }), [user, session, loading, isLoggedIn, login, logout, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Loading...</div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

// ============================================
// HOOKS
// ============================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Safe version that doesn't throw
 */
export function useAuthSafe(): AuthContextType | null {
  return useContext(AuthContext) ?? null;
}

/**
 * Hook for role-based access control
 */
export function useRoleAccess() {
  const { user } = useAuth();
  
  const role = user?.role || 'employee';
  const roleLevel = ROLE_HIERARCHY[role] || 0;

  const hasRole = useCallback((requiredRole: string) => {
    return role === requiredRole;
  }, [role]);

  const hasMinRole = useCallback((minRole: string) => {
    const minLevel = ROLE_HIERARCHY[minRole] || 0;
    return roleLevel >= minLevel;
  }, [roleLevel]);

  const isSuperAdmin = role === 'super_admin' || role === 'superadmin';
  const isOwner = role === 'owner';
  const isManager = role === 'manager';
  const isEmployee = role === 'employee';
  const isStaff = isManager || isEmployee;
  const canManageStation = isOwner || isSuperAdmin;
  const canManageEmployees = isOwner || isSuperAdmin;
  const canSetPrices = hasMinRole('manager');
  const canEnterReadings = true; // All roles can enter readings
  const canEditReadings = hasMinRole('manager');
  const canDeleteReadings = hasMinRole('manager');
  const canViewAnalytics = hasMinRole('manager');
  const canManageCreditors = hasMinRole('manager');
  const canSettleCredits = isOwner || isSuperAdmin;
  const canEnterExpenses = hasMinRole('manager');

  return {
    role,
    roleLevel,
    hasRole,
    hasMinRole,
    isSuperAdmin,
    isOwner,
    isManager,
    isEmployee,
    isStaff,
    canManageStation,
    canManageEmployees,
    canSetPrices,
    canEnterReadings,
    canEditReadings,
    canDeleteReadings,
    canViewAnalytics,
    canManageCreditors,
    canSettleCredits,
    canEnterExpenses,
  };
}
