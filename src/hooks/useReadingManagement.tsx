
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { NozzleReading } from '@/types/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface ManualReadingData {
  station_id: number;
  nozzle_id: number;
  cumulative_vol: number;
  reading_date: string;
  reading_time: string;
}

export interface ReceiptUploadResult {
  success: boolean;
  data: {
    readings_inserted: number;
    parsed_preview: unknown;
    readings: unknown[];
  };
}

export interface ManualReadingResult {
  success: boolean;
  data: unknown;
}

export const useReadingManagement = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const uploadReceiptForParsing = async (
    file: File,
    pumpSno?: string
  ): Promise<ReceiptUploadResult | null> => {
    try {
      setIsLoading(true);
      console.log('🔍 Starting receipt upload and parsing process...');

      // Check authentication using our custom auth system
      if (!user || !user.id) {
        console.error('❌ Authentication error: User not logged in');
        throw new Error("Authentication required. Please log in again.");
      }

      console.log('✅ Authentication verified, user ID:', user.id);

      // Validate file
      if (!file) {
        throw new Error("No file provided");
      }

      if (!pumpSno) {
        throw new Error("Pump serial number is required");
      }

      // Check file size (limit to 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error("File size too large. Maximum size is 10MB.");
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Invalid file type. Please upload an image (JPEG, PNG) or PDF.");
      }

      console.log('📤 Uploading file:', {
        name: file.name,
        size: file.size,
        type: file.type,
        pumpSno
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("pump_sno", pumpSno);
      formData.append("user_id", user.id.toString());

      const res = await apiClient.post<ReceiptUploadResult>('/readings/upload', formData);

      console.log('✅ Receipt upload successful:', res);

      const inserted = res?.data?.readings_inserted ?? 0;
      const parsed = res?.data?.parsed_preview ?? null;
      const readings = Array.isArray(res?.data?.readings) ? res.data.readings : [];

      toast({
        title: "Receipt Processing Complete",
        description: `Successfully processed ${inserted} readings`,
      });

      return {
        success: true,
        data: {
          readings_inserted: inserted,
          parsed_preview: parsed,
          readings,
        },
      };
    } catch (error: unknown) {
      console.error("💥 Receipt upload error:", error);
      let errorMessage = "An unexpected error occurred";
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message?: string }).message || errorMessage;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      toast({
        title: "Receipt Processing Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const submitManualReading = async (
    readingData: ManualReadingData
  ): Promise<ManualReadingResult | null> => {
    try {
      setIsLoading(true);
      console.log('📝 Submitting manual reading:', readingData);

      // Check authentication using our custom auth system
      if (!user || !user.id) {
        console.error('❌ Authentication error: User not logged in');
        throw new Error("Authentication required. Please log in again.");
      }

      // Validate data
      if (!readingData.station_id || !readingData.nozzle_id || !readingData.cumulative_vol) {
        throw new Error("Missing required fields");
      }

      if (readingData.cumulative_vol <= 0) {
        throw new Error("Cumulative volume must be greater than 0");
      }

      const payload = {
        ...readingData,
        user_id: user.id
      };

      const response = await apiClient.post<{ success: boolean; data: NozzleReading }>('/readings/manual', payload);
      if (!response || typeof response !== 'object' || response.success !== true) {
        throw new Error('Failed to save reading');
      }
      const data = response.data;
      console.log('✅ Manual reading saved:', data);
      toast({
        title: "Reading Saved",
        description: "Manual reading recorded successfully",
      });
      return { success: true, data };
    } catch (error: unknown) {
      console.error("💥 Manual reading error:", error);
      let errorMessage = "An unexpected error occurred";
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message?: string }).message || errorMessage;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      toast({
        title: "Manual Reading Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    uploadReceiptForParsing,
    submitManualReading,
  };
};
