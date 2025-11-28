/**
 * User Model
 * 
 * Types and interfaces for user-related entities.
 * Includes users, roles, permissions, and authentication.
 * 
 * @module core/models/user
 */

import { BaseEntity, Activatable, Contactable, CreateDTO, UpdateDTO } from './base.model';
import { UserRole } from '../enums';

// ============================================
// USER ENTITY
// ============================================

/**
 * User entity - represents a system user
 */
export interface User extends BaseEntity, Activatable, Contactable {
  email: string;
  name: string;
  role: UserRole;
  stationId?: string;
  planId?: string;
  avatarUrl?: string;
  lastLoginAt?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}

/**
 * User with related data
 */
export interface UserWithRelations extends User {
  stations?: UserStation[];
  plan?: UserPlan;
}

/**
 * Simplified station info for user context
 */
export interface UserStation {
  id: string;
  name: string;
  code?: string;
  address?: string;
  role?: UserRole;
}

/**
 * Simplified plan info for user context
 */
export interface UserPlan {
  id: string;
  name: string;
  maxStations: number;
  maxEmployees: number;
  features: string[];
}

// ============================================
// USER DTOs
// ============================================

/**
 * DTO for creating a new user
 */
export interface CreateUserDTO extends CreateDTO<User> {
  password: string;
  confirmPassword?: string;
}

/**
 * DTO for updating user profile
 */
export interface UpdateUserDTO extends Omit<UpdateDTO<User>, 'email' | 'role'> {
  currentPassword?: string;
  newPassword?: string;
}

/**
 * DTO for admin updating user
 */
export interface AdminUpdateUserDTO extends UpdateDTO<User> {
  role?: UserRole;
  isActive?: boolean;
}

// ============================================
// AUTHENTICATION TYPES
// ============================================

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Registration data
 */
export interface RegistrationData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  phone?: string;
  acceptTerms: boolean;
}

/**
 * Authentication result
 */
export interface AuthResult {
  user: UserWithRelations;
  token: string;
  refreshToken?: string;
  expiresAt: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset confirmation
 */
export interface PasswordResetConfirm {
  token: string;
  password: string;
  confirmPassword: string;
}

/**
 * Change password request
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// ============================================
// SESSION TYPES
// ============================================

/**
 * User session data
 */
export interface UserSession {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  stationId?: string;
  stations: UserStation[];
  token: string;
  expiresAt: string;
}

/**
 * Session status
 */
export interface SessionStatus {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserWithRelations | null;
  error?: string;
}

// ============================================
// PERMISSION TYPES
// ============================================

/**
 * Permission definition
 */
export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
}

/**
 * Role with permissions
 */
export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}

// ============================================
// USER FILTERS
// ============================================

/**
 * Filter options for user list
 */
export interface UserFilter {
  search?: string;
  role?: UserRole;
  stationId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}
