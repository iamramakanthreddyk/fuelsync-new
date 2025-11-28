/**
 * Base Model Types
 * 
 * Common interfaces and types used across all domain models.
 * Provides consistent patterns for entity identification, timestamps, and metadata.
 * 
 * @module core/models/base
 */

// ============================================
// BASE ENTITY INTERFACE
// ============================================

/**
 * Base interface for all entities with standard fields
 */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Base interface for entities with soft delete
 */
export interface SoftDeletableEntity extends BaseEntity {
  deletedAt?: string;
  isDeleted: boolean;
}

/**
 * Base interface for entities with audit trail
 */
export interface AuditableEntity extends BaseEntity {
  createdBy?: string;
  updatedBy?: string;
}

// ============================================
// STATUS INTERFACES
// ============================================

/**
 * Interface for entities with active/inactive status
 */
export interface Activatable {
  isActive: boolean;
}

/**
 * Interface for entities with multiple status states
 */
export interface Statusable<T extends string> {
  status: T;
}

// ============================================
// METADATA INTERFACES
// ============================================

/**
 * Interface for entities with notes/comments
 */
export interface Notable {
  notes?: string;
}

/**
 * Interface for entities with address
 */
export interface Addressable {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

/**
 * Interface for contactable entities
 */
export interface Contactable {
  phone?: string;
  email?: string;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Create request type - omit auto-generated fields
 */
export type CreateDTO<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;

/**
 * Update request type - all fields optional except id
 */
export type UpdateDTO<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>> & { id: string };

/**
 * List item type - for dropdown/select options
 */
export interface ListItem<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  icon?: string;
  description?: string;
}

/**
 * Key-value pair for generic mappings
 */
export interface KeyValue<K = string, V = unknown> {
  key: K;
  value: V;
}

// ============================================
// PAGINATION TYPES
// ============================================

/**
 * Pagination parameters for list requests
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

// ============================================
// FILTER TYPES
// ============================================

/**
 * Date range filter
 */
export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}

/**
 * Common filter options
 */
export interface BaseFilter extends DateRangeFilter, PaginationParams {
  search?: string;
  isActive?: boolean;
}

// ============================================
// RESULT TYPES
// ============================================

/**
 * Operation result with success/failure
 */
export interface Result<T = void, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
  message?: string;
}

/**
 * Async operation result
 */
export type AsyncResult<T = void, E = Error> = Promise<Result<T, E>>;
