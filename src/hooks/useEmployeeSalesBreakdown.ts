/**
 * Hook: useEmployeeSalesBreakdown
 * 
 * Fetches comprehensive employee sales data broken down by:
 * - Fuel Type (Petrol/Diesel/CNG)
 * - Payment Method (Cash/Online/Credit)
 * - Sale Amount & Quantity
 * - Variance (Expected vs Actual)
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { unwrapDataOrArray } from '@/lib/api-utils';

export interface EmployeeSalesByFuel {
  fuelType: string;
  quantity: number;
  saleValue: number;
  cashAmount: number;
  onlineAmount: number;
  creditAmount: number;
  transactionCount: number;
  averageTransactionValue: number;
}

export interface EmployeeSalesRecord {
  employeeId: string;
  employeeName: string;
  totalSales: number;
  totalQuantity: number;
  totalCash: number;
  totalOnline: number;
  totalCredit: number;
  totalTransactions: number;
  averageTransaction: number;
  byFuelType: EmployeeSalesByFuel[];
  variance?: {
    amount: number;
    percentage: number;
    status: 'BALANCED' | 'SHORTFALL' | 'OVERAGE';
  };
  lastActivityDate?: string;
}

export interface EmployeeSalesBreakdownResponse {
  data: EmployeeSalesRecord[];
  summary: {
    totalEmployees: number;
    totalSales: number;
    totalQuantity: number;
    totalCash: number;
    totalOnline: number;
    totalCredit: number;
    dateRange: { startDate: string; endDate: string };
  };
}

/**
 * Fetch employee sales breakdown for a station
 * Includes fuel type breakdown and payment method split
 */
export function useEmployeeSalesBreakdown(
  stationId: string | undefined,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: ['employee-sales-breakdown', stationId, startDate, endDate],
    queryFn: async () => {
      if (!stationId) return null;
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: EmployeeSalesRecord[];
          summary?: any;
        }>(
          `/stations/${stationId}/employee-sales?startDate=${startDate}&endDate=${endDate}`
        );

        const records = unwrapDataOrArray(response, []);
        if (!records || records.length === 0) return null;
        const totalSales = records.reduce((sum: number, r: EmployeeSalesRecord) => sum + r.totalSales, 0);
        const totalQuantity = records.reduce((sum: number, r: EmployeeSalesRecord) => sum + r.totalQuantity, 0);
        const totalCash = records.reduce((sum: number, r: EmployeeSalesRecord) => sum + r.totalCash, 0);
        const totalOnline = records.reduce((sum: number, r: EmployeeSalesRecord) => sum + r.totalOnline, 0);
        const totalCredit = records.reduce((sum: number, r: EmployeeSalesRecord) => sum + r.totalCredit, 0);

        return {
          data: records,
          summary: {
            totalEmployees: records.length,
            totalSales,
            totalQuantity,
            totalCash,
            totalOnline,
            totalCredit,
            dateRange: { startDate, endDate }
          }
        } as EmployeeSalesBreakdownResponse;
      } catch (error) {
        console.error('[useEmployeeSalesBreakdown] Error:', error);
        return null;
      }
    },
    enabled: !!stationId && !!startDate && !!endDate
  });
}
