/**
 * Auth API
 * Single source of truth for all authentication-related API calls.
 * Only this file (and other src/api/ modules) should import from api-client.
 */

import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-client';

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── API calls ──────────────────────────────────────────────────────────────

export const authApi = {
  /**
   * POST /auth/login
   */
  login: (email: string, password: string) =>
    apiClient.post<ApiResponse<{ token: string; user: AuthUser }>>('/auth/login', { email, password }),

  /**
   * GET /auth/me
   */
  me: () => apiClient.get<ApiResponse<AuthUser>>('/auth/me'),

  /**
   * POST /auth/logout
   */
  logout: () => apiClient.post<ApiResponse<null>>('/auth/logout'),

  /**
   * PUT /auth/password
   */
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.put<ApiResponse<null>>('/auth/password', { currentPassword, newPassword }),
};
