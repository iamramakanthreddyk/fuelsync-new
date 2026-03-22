import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useMemo } from 'react';
import { getToken, setToken, removeToken, getStoredUser, setStoredUser, ApiError } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errorUtils';
import { authService } from '@/services/authService';
import type { User, UserRole } from '@/types/api';

export type { User, UserRole };

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
  const session = useMemo(() => {
    return token ? { access_token: token } : null;
  }, [token]); // Changed dependency: use token directly
  const isLoggedIn = !!user && !!token;

  // Verify token with backend - delegate to authService
  const verifyToken = useCallback(async () => {
    try {
      const userData = await authService.getCurrentUser();
      if (userData) {
        const userWithStations = {
          ...userData,
          stations: userData.stations || [],
        } as User;
        setUser(userWithStations);
        setStoredUser(userWithStations);
      }
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

  // Delegate login to authService
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { token: authToken, user: authUser } = await authService.login(email, password);
      
      if (!authToken || !authUser) {
        throw new Error('Invalid login response: missing token or user');
      }
      
      // Store credentials
      setToken(authToken);
      const userData = {
        ...authUser,
        stations: authUser.stations || [],
      } as User;
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

  // Delegate logout to authService
  const logout = useCallback(async () => {
    try {
      await authService.logout();
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

  // Delegate profile update to authService
  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!user) throw new Error('Not authenticated');

    try {
      const updated = await authService.updateProfile(user.id, data);
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

  // Delegate password change to authService
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

// Note: useRoleAccess is exported from @/hooks/useRoleAccess to avoid circular imports
