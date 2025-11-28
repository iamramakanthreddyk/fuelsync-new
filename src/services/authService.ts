/**
 * Auth Service
 * Handles authentication API calls
 * Backend: /api/v1/auth/*
 */

import { apiClient, ApiResponse } from '@/lib/api-client';

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface AuthStation {
  id: string;
  name: string;
  brand?: string;
  address?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'super_admin' | 'owner' | 'manager' | 'employee';
  isActive: boolean;
  stationId?: string;
  stations: AuthStation[];
  createdAt?: string;
  updatedAt?: string;
}

interface LoginApiResponse {
  success: boolean;
  data: {
    token: string;
    user: AuthUser;
  };
}

export const authService = {
  /**
   * Login user
   * POST /api/v1/auth/login
   */
  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const response = await apiClient.post<LoginApiResponse>('/auth/login', { email, password });

    if (!response.success || !response.data) {
      throw new Error('Login failed');
    }

    return {
      token: response.data.token,
      user: response.data.user
    };
  },

  /**
   * Register new user
   * POST /api/v1/auth/register
   */
  async register(data: RegisterRequest): Promise<{ token: string; user: AuthUser }> {
    const response = await apiClient.post<LoginApiResponse>('/auth/register', data);

    if (!response.success || !response.data) {
      throw new Error('Registration failed');
    }

    return {
      token: response.data.token,
      user: response.data.user
    };
  },

  /**
   * Get current user
   * GET /api/v1/auth/me
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const response = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
      
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Logout
   * POST /api/v1/auth/logout
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }
  },

  /**
   * Change password
   * POST /api/v1/auth/change-password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>('/auth/change-password', {
      currentPassword,
      newPassword
    });

    if (!response.success) {
      throw new Error('Failed to change password');
    }
  },

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(email: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>('/auth/forgot-password', { email });

    if (!response.success) {
      throw new Error('Failed to send reset email');
    }
  }
};
