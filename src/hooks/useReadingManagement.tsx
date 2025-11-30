
import { useState } from 'react';
import { apiClient, ApiResponse, getToken } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface ManualReadingData {
  station_id: number;
  nozzle_id: number;
  cumulative_vol: number;
  reading_date: string;
  reading_time: string;
}

export interface OCRUploadResult {
  success: boolean;
  data: {
    readings_inserted: number;
    ocr_preview: any;
    readings: any[];
  };
}

export interface ManualReadingResult {
  success: boolean;
  data: any;
}

export const useReadingManagement = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const uploadImageForOCR = async (
    file: File,
    pumpSno?: string
  ): Promise<OCRUploadResult | null> => {
    try {
      setIsLoading(true);
      console.log('🔍 Starting OCR upload process...');

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

      // Use REST API endpoint for OCR upload
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
      const token = getToken();

      const response = await fetch(`${API_BASE_URL}/ocr/upload`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "OCR processing failed");
      }

      const data = await response.json();

      console.log('✅ OCR upload successful:', data);

      toast({
        title: "OCR Processing Complete",
        description: `Successfully processed ${data.data?.inserted || 0} readings`,
      });

      return {
        success: true,
        data: {
          readings_inserted: data.data?.inserted || 0,
          ocr_preview: data.data?.ocr,
          readings: data.data?.ocr?.nozzles || [],
        },
      };
    } catch (error: any) {
      console.error("💥 OCR upload error:", error);
      
      let errorMessage = "An unexpected error occurred";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      toast({
        title: "OCR Upload Failed",
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

      const response = await apiClient.post<any>('/readings/manual', payload);

      if (!response.success) {
        throw new Error('Failed to save reading');
      }

      console.log('✅ Manual reading saved:', response.data);

      toast({
        title: "Reading Saved",
        description: "Manual reading recorded successfully",
      });

      return { success: true, data: response.data };
    } catch (error: any) {
      console.error("💥 Manual reading error:", error);
      
      const errorMessage = error.message || "An unexpected error occurred";
      
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
    uploadImageForOCR,
    submitManualReading,
  };
};
