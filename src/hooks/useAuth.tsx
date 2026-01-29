import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useMemo } from 'react';
import { apiClient, getToken, setToken, removeToken, getStoredUser, setStoredUser, ApiError } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errorUtils';
import { authService } from '@/services/authService';
import type { User } from '@/types/api';

// ============================================
// TYPES
// ============================================

// Use canonical User and UserRole from `src/types/api.ts`

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
  updateProfile: (data: Partial<User>) => Promise<User>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
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

  // Verify token with backend
  const verifyToken = useCallback(async () => {
    try {
      const response = await apiClient.get<User>('/auth/me');
      // response is ApiResponse<User> so data is nested
      const userData = (response as any).data || response;
      const userWithStations = {
        ...userData,
        stations: userData.stations || [],
      };
      console.log('[DEBUG] User data from /auth/me:', userWithStations);
      console.log('[DEBUG] Plan data:', userWithStations.plan);
      setUser(userWithStations);
      setStoredUser(userWithStations);
    } catch (error: unknown) {
      // If API returned an ApiError with 401, clear auth
      if (error instanceof ApiError && error.statusCode === 401) {
        removeToken();
        setUser(null);
      } else {
        console.error('[AUTH] verifyToken error:', getErrorMessage(error));
      }
    }
  }, []);

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
      } catch (error: unknown) {
        console.error('[AUTH] Init error:', getErrorMessage(error));
        removeToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    // Listen for global auth expiry events (dispatched by api-client)
    const onAuthExpired = () => {
      removeToken();
      setUser(null);
    };
    window.addEventListener('auth-expired', onAuthExpired as EventListener);

    // Keep auth state in sync across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'fuelsync_token' && !e.newValue) {
        // token removed in another tab
        setUser(null);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('auth-expired', onAuthExpired as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, [verifyToken]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await apiClient.post<{ token: string; user: User }>('/auth/login', { email, password });
      
      // response is ApiResponse<{ token: string; user: User }> so data is nested
      const { token: authToken, user: authUser } = (response as any).data || response;
      
      if (!authToken || !authUser) {
        throw new Error('Invalid login response: missing token or user');
      }
      
      // Store credentials
      setToken(authToken);
      const userData = {
        ...authUser,
        stations: authUser.stations || [],
      };
      setStoredUser(userData);
      setUser(userData);

    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      console.error('[AUTH] Login error:', msg);
      if (msg.includes('Invalid credentials') || (error instanceof ApiError && error.statusCode === 401)) {
        throw new Error('Invalid credentials');
      }
      throw new Error(msg);
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

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!user) throw new Error('Not authenticated');

    try {
      const response = await apiClient.put<{ success: boolean; data: User }>(`/users/${user.id}`, data);
      const updated = (response as any).data || response;
      const userWithStations = { ...updated, stations: updated.stations || [] } as User;
      setUser(userWithStations);
      setStoredUser(userWithStations);
      return userWithStations;
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      console.error('[AUTH] updateProfile error:', msg);
      throw error;
    }
  }, [user]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      await authService.changePassword(currentPassword, newPassword);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      console.error('[AUTH] changePassword error:', msg);
      throw error;
    }
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
    updateProfile,
    changePassword,
  }), [user, session, loading, isLoggedIn, login, logout, updateUser, updateProfile, changePassword]);

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
  
  const normalizeRole = (r: string): string => {
    const lower = r.toLowerCase().trim();
    if (lower === 'superadmin' || lower === 'super admin') return 'super_admin';
    if (lower === 'pump owner' || lower === 'pump_owner') return 'owner';
    return r;
  };

  const role = normalizeRole(user?.role || 'employee');
  const roleLevel = ROLE_HIERARCHY[role] || 0;

  const hasRole = useCallback((requiredRole: string) => {
    return normalizeRole(role) === normalizeRole(requiredRole);
  }, [role]);

  const hasMinRole = useCallback((minRole: string) => {
    const normalizedMinRole = normalizeRole(minRole);
    const minLevel = ROLE_HIERARCHY[normalizedMinRole] || 0;
    return roleLevel >= minLevel;
  }, [roleLevel]);

  const isSuperAdmin = role === 'super_admin';
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
