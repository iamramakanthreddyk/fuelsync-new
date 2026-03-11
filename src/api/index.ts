/**
 * API — single source of truth for all frontend API calls
 *
 * Import everything from here (or '@/api/...' for tree-shaking):
 *   import { expenseApi, analyticsApi, stationApi, ... } from '@/api';
 *
 * The only file that should import from '@/lib/api-client' directly are
 * the individual domain modules inside this folder.
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
