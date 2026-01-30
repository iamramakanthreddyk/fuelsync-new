import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useEffectiveFeatures(userId?: string) {
  return useQuery({
    queryKey: ['effective-features', userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await apiClient.get(`/users/${userId}/effective-features`);
      return (res as any)?.data ?? null;
    },
    enabled: !!userId,
    retry: false,
  });
}
