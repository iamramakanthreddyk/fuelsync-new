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
 * Backend: /api/v1/creditors/ledger?search=...
 */
export const creditService = {
  /**
   * Get credit ledger (outstanding credits per customer)
   * GET /api/v1/creditors/ledger?search=...
   */
  async getCreditLedger(search: string = ''): Promise<Creditor[]> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const response = await apiClient.get<Creditor[]>(`/creditors/ledger${params}`);
    return Array.isArray(response) ? response : [];
  },
};
