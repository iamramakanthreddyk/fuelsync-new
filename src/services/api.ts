import { apiClient } from '@/lib/api-client';

export class ApiService {
  async getNozzleReadings(stationId: string) {
    const response = await apiClient.get<NozzleReading[]>(`/readings?stationId=${stationId}`);

    return {
      data: response?.map(reading => ({
        id: reading.id,
        nozzleId: reading.nozzleId,
        stationId: reading.stationId,
        previousReading: reading.previousReading,
        currentReading: reading.currentReading,
        litresSold: reading.litresSold,
        fuelType: reading.fuelType,
        readingDate: reading.readingDate,
        createdAt: reading.createdAt,
        updatedAt: reading.updatedAt
      })) || []
    };
  }

  async createManualReading(data: {
    nozzleId: string;
    currentReading: number;
    readingDate: string;
  }, stationId: string) {
    const response = await apiClient.post<NozzleReading>('/readings', {
      nozzleId: data.nozzleId,
      stationId,
      currentReading: data.currentReading,
      readingDate: data.readingDate
    });

    return response;
  }

  async updateNozzleReading(id: string, data: { currentReading: number }) {
    const response = await apiClient.put<{ success: boolean; data: NozzleReading }>(`/readings/${id}`, data);
    if (!response.success) throw new Error('Failed to update reading');
    return response.data;
  }

  async deleteNozzleReading(id: string) {
    const response = await apiClient.delete<{ success: boolean }>(`/readings/${id}`);
    if (!response.success) throw new Error('Failed to delete reading');
  }

  async getPumps(stationId: string) {
    const response = await apiClient.get<{ success: boolean; data: Pump[] }>(`/stations/${stationId}/pumps`);
    if (!response.success) throw new Error('Failed to fetch pumps');
    
    return { 
      data: response.data?.map(pump => ({
        id: pump.id,
        name: pump.name || `Pump ${pump.pumpNumber}`,
        pumpNumber: pump.pumpNumber,
        status: pump.isActive ? 'active' : 'inactive',
        nozzles: (pump.nozzles || []).map((nozzle: Nozzle) => ({
          id: nozzle.id,
          pumpId: pump.id,
          number: nozzle.nozzleNumber,
          fuelType: nozzle.fuelType,
          status: nozzle.status
        })),
        createdAt: pump.createdAt,
        totalSalesToday: 0
      })) || []
    };
  }

  async updatePumpStatus(id: string, isActive: boolean) {
    const response = await apiClient.put<{ success: boolean; data: Pump }>(`/stations/pumps/${id}`, { isActive });
    if (!response.success) throw new Error('Failed to update pump');
    return response.data;
  }

  async updateNozzleFuelType(id: string, fuelType: string) {
    const response = await apiClient.put<{ success: boolean; data: Nozzle }>(`/stations/nozzles/${id}`, { fuelType });
    if (!response.success) throw new Error('Failed to update nozzle');
    return response.data;
  }

  async getSales(stationId: string) {
    const response = await apiClient.get<{ success: boolean; data: NozzleReading[] }>(`/readings?stationId=${stationId}`);
    if (!response.success) throw new Error('Failed to fetch sales');

    // Calculate sales from readings
    return {
      data: response.data?.filter((r: NozzleReading) => r.litresSold > 0).map((reading: NozzleReading) => ({
        id: reading.id,
        nozzleId: reading.nozzleId,
        fuelType: reading.fuelType,
        litres: reading.litresSold,
        pricePerLitre: reading.pricePerLitre || 0,
        totalAmount: reading.totalAmount || 0,
        timestamp: reading.createdAt,
        readingDate: reading.readingDate
      })) || []
    };
  }

  async getDailySummary(stationId: string) {
    const today = new Date().toISOString().split('T')[0];
    const response = await apiClient.get<DashboardSummary>(`/dashboard/summary?stationId=${stationId}&startDate=${today}&endDate=${today}`);
    return {
      cash: response.cashCollection || 0,
      card: 0, // Not available in DashboardSummary
      upi: 0,  // Not available in DashboardSummary
      credit: response.creditSales || 0,
      total: response.totalSales || 0
    };
  }

  async generateReport(stationId: string, startDate: string, endDate: string) {
    const response = await apiClient.get<NozzleReading[]>(`/readings?stationId=${stationId}&startDate=${startDate}&endDate=${endDate}`);
    return { data: response || [] };
  }

  async getUploads(stationId: string) {
    // No OCR uploads in the REST API - return empty for now
    return { data: [] };
  }

  async uploadReceipt(file: File, stationId: string) {
    // OCR upload not implemented in REST API
    throw new Error('OCR upload not implemented');
  }
}

export const apiService = new ApiService();
