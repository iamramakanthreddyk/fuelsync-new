
import { useNavigate } from "react-router-dom";
import { useFuelPricesData } from "@/hooks/useFuelPricesData";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { getBasePath } from "@/lib/roleUtils";

export function useSetupChecklist() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: fuelPrices } = useFuelPricesData();
  const { data } = useDashboardData();

  // Check if user has any stations
  const hasStations = user?.stations && user.stations.length > 0;

  // Expand/modify checklist items as needed
  const checklist = [];

  // For owners: first step is creating a station
  if (user?.role === 'owner') {
    checklist.push({
      key: "create_station",
      label: "Create your first station",
      completed: !!hasStations,
      action: () => navigate("/stations"),
    });
  }

  // Only show these items if user has a station
  if (hasStations) {
    // Fuel prices are always needed
    checklist.push({
      key: "fuel_price_set",
      label: "Set fuel prices",
      completed: !!(fuelPrices && fuelPrices.length > 0),
      action: () => navigate("/prices"),
    });

    // For employees: require entering first reading
    // For managers/owners: check if station has any activity today (readings entered)
    if (user?.role === 'employee') {
      checklist.push({
        key: "sales_data_entered",
        label: "Enter your first reading",
        completed: !!data && data.totalReadings > 0,
        action: () => navigate(`${getBasePath(user?.role)}/quick-entry`),
      });
    } else if (user?.role === 'manager' || user?.role === 'owner') {
      // For managers/owners, check if station has activity today
      // If no readings today, suggest they check station operations
      checklist.push({
        key: "station_active_today",
        label: "Check station operations today",
        completed: !!data && data.totalReadings > 0,
        action: () => navigate(`${getBasePath(user?.role)}/dashboard`),
      });
    }
  }

  return checklist;
}
