
import { useNavigate } from "react-router-dom";
import { useFuelPricesData } from "@/hooks/useFuelPricesData";
import { useFuelPrices } from '@/hooks/api';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useFuelPricesGlobal } from '@/context/FuelPricesContext';
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { getBasePath } from "@/lib/roleUtils";

export function useSetupChecklist() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentStation } = useRoleAccess();
  const { pricesArray, pricesByStation } = useFuelPricesGlobal();
  const stationId = currentStation?.id || user?.stations?.[0]?.id;
  const { data: fuelPrices } = useFuelPricesData(stationId);
  // Also check the direct API hook to read the `current` wrapper (ApiResponse.data.current)
  const fuelPricesQuery = useFuelPrices(stationId || '');
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
    const hasPricesFromApi = !!(fuelPrices && fuelPrices.length > 0) || !!(fuelPricesQuery.data && fuelPricesQuery.data.data && Array.isArray(fuelPricesQuery.data.data.current) && fuelPricesQuery.data.data.current.length > 0);
    const hasPricesFromGlobal = !!(stationId && pricesByStation && pricesByStation[stationId] && Object.keys(pricesByStation[stationId]).length > 0);
    const hasPricesArray = !!(Array.isArray(pricesArray) && pricesArray.length > 0);

    checklist.push({
      key: "fuel_price_set",
      label: "Set fuel prices",
      completed: hasPricesFromApi || hasPricesFromGlobal || hasPricesArray,
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
