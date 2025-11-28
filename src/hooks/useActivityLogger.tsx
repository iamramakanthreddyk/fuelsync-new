
import { useAuth } from "./useAuth";
import { useCallback } from "react";
import { apiClient } from "@/lib/api-client";

/**
 * useActivityLogger - Hook to log user activity to backend
 * @returns logActivity: (activityType: string, details?: Record<string, any>) => Promise<void>
 */
export function useActivityLogger() {
  const { user } = useAuth();

  /**
   * Logs a user activity event to the backend.
   * @param activityType - The type of activity, e.g. 'dashboard_view'
   * @param details - (Optional) Extra details as a JSON object. Device, browser, page params, etc.
   * @param stationId - (Optional) For station accounts, log against the station (defaults to user's first station)
   */
  const logActivity = useCallback(
    async (
      activityType: string,
      details?: Record<string, any>,
      stationId?: number
    ) => {
      if (!user?.id) return;
      // Use provided stationId or user's first (if available)
      let station_id = stationId;
      if (!station_id && user.stations && user.stations.length > 0) {
        station_id = user.stations[0]?.id;
      }
      
      try {
        await apiClient.post('/activity-logs', {
          user_id: user.id,
          station_id: station_id ?? null,
          activity_type: activityType,
          details: details ?? null,
        });
      } catch (error) {
        // Silently fail for activity logging - non-critical
        console.warn("Failed to log activity:", error);
      }
    },
    [user]
  );

  return logActivity;
}
