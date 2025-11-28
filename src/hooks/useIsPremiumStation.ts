
import { useQuery } from "@tanstack/react-query";
import { planLimitsService } from "@/services/planLimitsService";

/**
 * useIsPremiumStation
 * Returns true if the given stationId is premium (has OCR access)
 */
export function useIsPremiumStation(stationId?: number) {
  return useQuery({
    queryKey: ["plan-limits", stationId],
    queryFn: async () => {
      if (!stationId) return false;
      const limits = await planLimitsService.getPlanLimits(stationId);
      // Premium if OCR is not unbounded (i.e. has OCR allowed)
      return !!limits.maxOcrMonthly;
    },
    enabled: !!stationId,
  });
}
