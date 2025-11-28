import { apiClient, ApiResponse } from '@/lib/api-client';

export interface PlanLimits {
  maxPumps: number | null;
  maxNozzles: number | null;
  maxEmployees: number | null;
  maxOcrMonthly: number | null;
  allowManualEntry: boolean;
  editFuelType: boolean;
  exportReports: boolean;
}

export interface PlanUsage {
  ocrCount: number;
  pumpsUsed: number;
  nozzlesUsed: number;
  employeesCount: number;
}

export class PlanLimitsError extends Error {
  public code: string;
  
  constructor(message: string, code: string = 'PLAN_LIMIT_EXCEEDED') {
    super(message);
    this.name = 'PlanLimitsError';
    this.code = code;
  }
}

export const planLimitsService = {
  async getPlanLimits(stationId: number): Promise<PlanLimits> {
    const response = await apiClient.get<ApiResponse<PlanLimits>>(
      `/stations/${stationId}/plan-limits`
    );

    if (!response.success || !response.data) {
      throw new Error('Station not found');
    }

    return response.data;
  },

  async getCurrentUsage(stationId: number): Promise<PlanUsage> {
    try {
      const response = await apiClient.get<ApiResponse<PlanUsage>>(
        `/stations/${stationId}/plan-usage`
      );

      if (response.success && response.data) {
        return response.data;
      }

      return {
        ocrCount: 0,
        pumpsUsed: 0,
        nozzlesUsed: 0,
        employeesCount: 0,
      };
    } catch (error) {
      console.error('Failed to fetch plan usage:', error);
      return {
        ocrCount: 0,
        pumpsUsed: 0,
        nozzlesUsed: 0,
        employeesCount: 0,
      };
    }
  },

  async checkOCRLimit(stationId: number): Promise<void> {
    const [limits, usage] = await Promise.all([
      this.getPlanLimits(stationId),
      this.getCurrentUsage(stationId)
    ]);

    if (limits.maxOcrMonthly && usage.ocrCount >= limits.maxOcrMonthly) {
      throw new PlanLimitsError(
        `OCR limit exceeded. Current usage: ${usage.ocrCount}/${limits.maxOcrMonthly}`,
        'OCR_LIMIT_EXCEEDED'
      );
    }
  },

  async checkPumpLimit(stationId: number): Promise<void> {
    const limits = await this.getPlanLimits(stationId);
    
    if (!limits.maxPumps) return;

    const usage = await this.getCurrentUsage(stationId);

    if (usage.pumpsUsed >= limits.maxPumps) {
      throw new PlanLimitsError(
        `Pump limit exceeded. Current: ${usage.pumpsUsed}/${limits.maxPumps}`,
        'PUMP_LIMIT_EXCEEDED'
      );
    }
  },

  async checkEmployeeLimit(stationId: number): Promise<void> {
    const limits = await this.getPlanLimits(stationId);
    
    if (!limits.maxEmployees) return;

    const usage = await this.getCurrentUsage(stationId);

    if (usage.employeesCount >= limits.maxEmployees) {
      throw new PlanLimitsError(
        `Employee limit exceeded. Current: ${usage.employeesCount}/${limits.maxEmployees}`,
        'EMPLOYEE_LIMIT_EXCEEDED'
      );
    }
  },

  async incrementOCRUsage(stationId: number): Promise<void> {
    await this.checkOCRLimit(stationId);
    
    await apiClient.post(`/stations/${stationId}/increment-ocr-usage`, {});
  },

  async updatePumpCount(stationId: number): Promise<void> {
    await apiClient.post(`/stations/${stationId}/update-pump-count`, {});
  }
};
