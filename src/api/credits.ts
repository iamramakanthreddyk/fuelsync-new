/**
 * Credits API
 * Single source of truth for creditor and credit transaction API calls.
 * Only this file (and other src/api/ modules) should import from api-client.
 */

import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-client';
import type { Creditor, CreditTransaction } from '@/types/api';

export const creditApi = {
  /** GET /credits/creditors?stationId=... */
  getCreditors: (stationId: string) =>
    apiClient.get<ApiResponse<Creditor[]>>(`/credits/creditors?stationId=${stationId}`),

  /** GET /credits/creditors/:id */
  getCreditor: (id: string) =>
    apiClient.get<ApiResponse<Creditor>>(`/credits/creditors/${id}`),

  /** POST /credits/creditors */
  createCreditor: (data: Partial<Creditor>) =>
    apiClient.post<ApiResponse<Creditor>>('/credits/creditors', data),

  /** POST /credits/creditors/:creditorId/sales */
  addSale: (creditorId: string, data: Partial<CreditTransaction>) =>
    apiClient.post<ApiResponse<CreditTransaction>>(
      `/credits/creditors/${creditorId}/sales`,
      data
    ),

  /** POST /credits/creditors/:creditorId/settle */
  settle: (
    creditorId: string,
    data: {
      amount?: number;
      referenceNumber?: string;
      notes?: string;
      invoiceNumber?: string;
      allocations?: Array<{ creditTransactionId: string; amount: number }>;
    }
  ) =>
    apiClient.post<ApiResponse<CreditTransaction>>(
      `/credits/creditors/${creditorId}/settle`,
      data
    ),
};
