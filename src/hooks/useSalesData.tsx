
import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import { useRoleAccess } from "./useRoleAccess";

interface Sale {
  id: string;
  station_id: string;
  station_name: string;
  nozzle_id: string;
  nozzle_number: number;
  fuel_type: string;
  pump_id: string;
  pump_name: string;
  reading_id: string;
  reading_date: string;
  delta_volume_l: number;
  price_per_litre: number;
  total_amount: number;
  payment_breakdown: Record<string, unknown>;
  cash_amount: number;
  online_amount: number;
  entered_by: string;
  created_at: string;
}

export function useSalesData(date?: string) {
  const { currentStation, canAccessAllStations } = useRoleAccess();

  return useQuery({
    queryKey: ['sales', currentStation?.id, date],
    queryFn: async (): Promise<Sale[]> => {
      if (!canAccessAllStations && !currentStation?.id) {
        return [];
      }

      let url = '/sales';
      const params = new URLSearchParams();

      if (!canAccessAllStations && currentStation?.id) {
        params.append('station_id', currentStation.id.toString());
      }

      if (date) {
        params.append('date', date);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      try {
        // apiClient.get already unwraps {success, data} structure
        const sales = await apiClient.get<Sale[]>(url);
        
        console.log('💰 useSalesData - API response:', sales);
        console.log('💰 useSalesData - Is array?', Array.isArray(sales));
        console.log('💰 useSalesData - Length:', sales?.length);
        
        if (Array.isArray(sales)) {
          return sales;
        }
        return [];
      } catch (error) {
        console.error('Failed to fetch sales:', error);
        return [];
      }
    },
    enabled: canAccessAllStations || !!currentStation?.id,
  });
}
