/**
 * API — single source of truth for all frontend API calls
 *
 * Import domain API objects from here (or '@/api/...' for tree-shaking):
 *   import { expenseApi, analyticsApi, stationApi, authApi, configApi, ... } from '@/api';
 *
 * Rules:
 *  - Domain modules (this folder) are the ONLY files that import from '@/lib/api-client'.
 *  - React Query hooks (src/hooks/api/) import ONLY from '@/api' — never from lib/api-*.
 *  - Pages and components import ONLY from '@/api' or '@/hooks/api'.
 */

export * from './auth';
export * from './stations';
export * from './readings';
export * from './shifts';
export * from './credits';
export * from './expenses';
export * from './analytics';
export * from './tanks';
export * from './users';
