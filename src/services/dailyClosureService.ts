/*
 * Compatibility shim for `dailyClosureService`.
 *
 * This file intentionally re-exports the new `settlementsService` to
 * preserve backward compatibility for imports that still reference
 * `dailyClosureService`. The plan is to remove this shim in a future
 * major version once all consumers have migrated to `settlementsService`.
 */
import { settlementsService } from './settlementsService';

export type { DailySummary, PumpSummary } from './settlementsService';

export const dailyClosureService = settlementsService;

export default dailyClosureService;
