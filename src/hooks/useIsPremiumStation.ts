
import { useQuery } from "@tanstack/react-query";
import { planLimitsService } from "@/services/planLimitsService";

/**
 * useIsPremiumStation
 * Returns true if the given stationId is premium (has enhanced manual/parsed readings access)
 */
export function useIsPremiumStation(stationId?: number) {
  return useQuery({
    queryKey: ["plan-limits", stationId],
    queryFn: async () => {
      if (!stationId) return false;
      const limits = await planLimitsService.getPlanLimits(stationId);
      // Premium if manual readings limit is set (indicates enhanced plan features)
      return !!limits.maxManualReadingsMonthly;
    },
    enabled: !!stationId,
  });
}
