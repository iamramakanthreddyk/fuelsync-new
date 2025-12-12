import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useNozzleLastReading(nozzleId?: string) {
  return useQuery({
    queryKey: ['nozzleLastReading', nozzleId],
    queryFn: async () => {
      if (!nozzleId) return null;
      const res: any = await apiClient.get(`/readings/last?nozzleId=${nozzleId}`);
      if (res && res.success && res.data) {
        return res.data.readingValue;
      }
      return null;
    },
    enabled: !!nozzleId,
  });
}
