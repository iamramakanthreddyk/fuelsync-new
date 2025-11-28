import { apiClient, ApiResponse } from '@/lib/api-client';

/**
 * Fuel Price interface matching backend FuelPrice model
 */
export interface FuelPrice {
  id: string;
  stationId: string;
  fuelType: 'petrol' | 'diesel';
  price: number;
  effectiveFrom: string;
  updatedBy: string;
  createdAt: string;
}

/**
 * Response structure from GET /api/v1/stations/:stationId/prices
 */
interface FuelPricesResponse {
  current: FuelPrice[];
  history: FuelPrice[];
}

/**
 * Fuel Price Service
 * Uses backend stations endpoints for fuel price management
 * Backend: /api/v1/stations/:stationId/prices
 */
export const fuelPriceService = {
  /**
   * Get fuel prices for a station
   * GET /api/v1/stations/:stationId/prices
   */
  async getFuelPrices(stationId: string): Promise<FuelPrice[]> {
    try {
      const response = await apiClient.get<ApiResponse<FuelPricesResponse>>(
        `/stations/${stationId}/prices`
      );

      if (response.success && response.data) {
        return response.data.current || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch fuel prices:', error);
      return [];
    }
  },

  /**
   * Get current price for a specific fuel type
   * Returns the latest price from the prices endpoint
   */
  async getCurrentPrice(stationId: string, fuelType: 'petrol' | 'diesel'): Promise<number> {
    try {
      const response = await apiClient.get<ApiResponse<FuelPricesResponse>>(
        `/stations/${stationId}/prices`
      );

      if (response.success && response.data) {
        const price = response.data.current.find(p => p.fuelType === fuelType);
        if (price) {
          return parseFloat(String(price.price));
        }
      }
      throw new Error(`No price found for ${fuelType} at station ${stationId}`);
    } catch (error) {
      console.error('Failed to get current price:', error);
      throw error;
    }
  },

  /**
   * Set a new fuel price
   * POST /api/v1/stations/:stationId/prices
   */
  async setFuelPrice(
    stationId: string,
    fuelType: 'petrol' | 'diesel',
    price: number,
    effectiveFrom?: string
  ): Promise<FuelPrice> {
    const response = await apiClient.post<ApiResponse<FuelPrice>>(
      `/stations/${stationId}/prices`,
      {
        fuelType,
        price,
        effectiveFrom: effectiveFrom || new Date().toISOString().split('T')[0]
      }
    );

    if (!response.success || !response.data) {
      throw new Error('Failed to set fuel price');
    }

    return response.data;
  },

  /**
   * Get price history for a station
   * Uses the history field from GET /api/v1/stations/:stationId/prices
   */
  async getPriceHistory(
    stationId: string,
    fuelType?: 'petrol' | 'diesel',
    limit: number = 10
  ): Promise<FuelPrice[]> {
    try {
      const response = await apiClient.get<ApiResponse<FuelPricesResponse>>(
        `/stations/${stationId}/prices`
      );

      if (response.success && response.data) {
        let history = response.data.history || [];
        
        if (fuelType) {
          history = history.filter(p => p.fuelType === fuelType);
        }
        
        return history.slice(0, limit);
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch price history:', error);
      return [];
    }
  },

  /**
   * Check if prices are set for the station
   * GET /api/v1/stations/:stationId/prices/check
   */
  async checkPricesSet(stationId: string): Promise<{
    petrolSet: boolean;
    dieselSet: boolean;
    allSet: boolean;
  }> {
    try {
      const response = await apiClient.get<ApiResponse<{
        petrolSet: boolean;
        dieselSet: boolean;
        allSet: boolean;
      }>>(`/stations/${stationId}/prices/check`);

      if (response.success && response.data) {
        return response.data;
      }
      return { petrolSet: false, dieselSet: false, allSet: false };
    } catch (error) {
      console.error('Failed to check prices:', error);
      return { petrolSet: false, dieselSet: false, allSet: false };
    }
  }
};
