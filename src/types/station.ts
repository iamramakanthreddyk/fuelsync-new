/**
 * Central Station-related types
 * Extracted to avoid duplicate local declarations across services and components
 */
import type { ApiResponse } from '@/lib/api-client';

export interface StationSettings {
  requireShiftForReadings: boolean;
  alertOnMissedReadings: boolean;
  missedReadingThresholdDays: number;
  defaultShiftType?: string;
  autoCloseShifts?: boolean;
  shiftEndReminderMinutes?: number;
}

export interface StationSettingsPayload {
  id: string;
  name: string;
  settings: StationSettings;
}

export type StationSettingsResponse = ApiResponse<StationSettingsPayload>;

export default StationSettings;

// Additional station-related small interfaces centralized here
export interface StationOwner {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface StationPump {
  id: string;
  pumpNumber: number;
  name: string;
  status: string;
  nozzleCount: number;
}

export interface StationStaff {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

export interface StationMetrics {
  pumpCount: number;
  activePumps: number;
  nozzleCount: number;
  activeNozzles: number;
  staffCount: number;
  activeStaff: number;
  todaySales?: number;
  monthSales?: number;
}

export interface StationNotificationSettings {
  lowInventoryAlert: boolean;
  lowInventoryThreshold: number;
  criticalInventoryThreshold: number;
  dailySummaryEmail: boolean;
  dailySummaryTime: string;
  shiftEndReminder: boolean;
  priceChangeAlert: boolean;
}

export interface StationConfiguration {
  operational: StationSettings;
  notifications: StationNotificationSettings;
}
