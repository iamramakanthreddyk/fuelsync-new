/**
 * Settlements Service
 * Minimal stub used by barrel exports
 */

import { apiClient, ApiResponse } from '@/lib/api-client';

export interface Settlement {
  id: string;
  stationId: string;
  amount: number;
  settledAt: string;
  notes?: string;
}

export const settlementsService = {
  async listSettlements(stationId: string): Promise<Settlement[]> {
    const res = await apiClient.get<ApiResponse<Settlement[]>>(`/settlements?stationId=${stationId}`);
    if (res.success && res.data) return res.data;
    return [];
  }
};

export default settlementsService;
