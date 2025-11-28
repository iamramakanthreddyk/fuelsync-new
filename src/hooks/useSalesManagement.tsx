import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import { useAuth } from "./useAuth";

interface ManualEntryData {
  station_id: number;
  nozzle_id: number;
  cumulative_volume: number;
  user_id: string;
}

interface SalesFilters {
  station_id?: number;
  pump_id?: number;
  nozzle_id?: number;
  start_date?: string;
  end_date?: string;
  today?: boolean;
}

export function useSalesManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createManualEntry = useMutation({
    mutationFn: async (data: ManualEntryData) => {
      const response = await apiClient.post<ApiResponse<any>>('/sales/manual-entry', {
        ...data,
        user_id: user?.id
      });

      if (!response.success) {
        throw new Error('Failed to create manual entry');
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales-summary'] });
    },
  });

  const getSales = (filters: SalesFilters = {}) => {
    return useQuery({
      queryKey: ['sales', filters],
      queryFn: async () => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, value.toString());
          }
        });

        const response = await apiClient.get<ApiResponse<any[]>>(
          `/sales?${params.toString()}`
        );

        if (response.success && response.data) {
          return response.data;
        }
        return [];
      },
    });
  };

  const getSalesSummary = (filters: SalesFilters = {}) => {
    return useQuery({
      queryKey: ['sales-summary', filters],
      queryFn: async () => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, value.toString());
          }
        });

        const response = await apiClient.get<ApiResponse<any>>(
          `/sales/summary?${params.toString()}`
        );

        if (response.success && response.data) {
          return response.data;
        }
        return null;
      },
    });
  };

  return {
    createManualEntry,
    getSales,
    getSalesSummary,
  };
}
