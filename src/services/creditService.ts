import { apiClient } from '@/lib/api-client';

export interface Creditor {
  id: string;
  name: string;
  mobile?: string;
  creditLimit: number;
  outstanding: number;
  lastSaleDate?: string;
}

/**
 * Credit Service
 * Handles credit ledger API calls
 * Backend: /api/v1/creditors/ledger?search=...&stationId=...
 */
export const creditService = {
  /**
   * Get credit ledger (outstanding credits per customer)
   * GET /api/v1/creditors/ledger?search=...&stationId=...
   */
  async getCreditLedger(search: string = '', stationId?: string, showAll: boolean = false): Promise<Creditor[]> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (stationId) params.set('stationId', stationId);
    if (showAll) params.set('showAll', 'true');
    const queryString = params.toString();
    const url = queryString ? `/creditors/ledger?${queryString}` : '/creditors/ledger';
    const response = await apiClient.get<Creditor[]>(url);
    return Array.isArray(response) ? response : [];
  },
};
