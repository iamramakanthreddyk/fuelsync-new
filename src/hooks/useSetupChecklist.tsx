
import { useNavigate } from "react-router-dom";
import { useFuelPricesData } from "@/hooks/useFuelPricesData";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";

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
    checklist.push(
      {
        key: "fuel_price_set",
        label: "Set fuel prices",
        completed: !!(fuelPrices && fuelPrices.length > 0),
        action: () => navigate("/prices"),
      },
      {
        key: "sales_data_entered",
        label: "Enter your first reading",
        completed: !!data && data.totalReadings > 0,
        action: () => navigate("/data-entry"),
      }
    );
  }

  return checklist;
}
