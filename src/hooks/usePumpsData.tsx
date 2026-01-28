/**
 * usePumpsData Hook - DEPRECATED
 *
 * This hook has been replaced by the centralized usePumps hook from @/hooks/api
 * Please use: import { usePumps } from '@/hooks/api'
 *
 * @deprecated Use usePumps from @/hooks/api instead
 */

import { usePumps } from './api';

// Re-export the centralized hook for backward compatibility
export const usePumpsData = usePumps;

// Keep the old interface for backward compatibility
export type { Pump as PumpType, Nozzle as NozzleType } from '@/types/api';
