
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { readingService } from '@/services/readingService';
import type { ManualReadingData } from '@/services/readingService';

/**
 * Hook: Upload receipt for parsing
 * Returns: useMutation with { mutateAsync, isPending, error }
 */
export function useUploadReceiptForParsing() {
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { file: File; pumpSno: string }) => {
      if (!user?.id) throw new Error('Authentication required');

      // File validation
      if (!data.file) throw new Error('No file provided');
      if (!data.pumpSno) throw new Error('Pump serial number is required');

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (data.file.size > maxSize) {
        throw new Error('File size too large. Maximum size is 10MB.');
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(data.file.type)) {
        throw new Error('Invalid file type. Please upload an image (JPEG, PNG) or PDF.');
      }

      // Delegate to service
      return await readingService.uploadReceiptForParsing(data.file, data.pumpSno, user.id);
    },
    onSuccess: (data) => {
      toast({
        title: 'Receipt Processing Complete',
        description: `Successfully processed ${data.readings_inserted} readings`,
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      toast({
        title: 'Receipt Processing Failed',
        description: message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook: Submit manual reading
 * Returns: useMutation with { mutateAsync, isPending, error }
 */
export function useSubmitManualReading() {
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (readingData: Omit<ManualReadingData, 'user_id'>) => {
      if (!user?.id) throw new Error('Authentication required');

      // Validation
      if (!readingData.station_id || !readingData.nozzle_id || !readingData.cumulative_vol) {
        throw new Error('Missing required fields');
      }

      if (readingData.cumulative_vol <= 0) {
        throw new Error('Cumulative volume must be greater than 0');
      }

      // Delegate to service
      return await readingService.submitManualReading({
        ...readingData,
        user_id: user.id,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Reading Saved',
        description: 'Manual reading recorded successfully',
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      toast({
        title: 'Failed to Save Reading',
        description: message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Legacy hook for backward compatibility
 * Use useUploadReceiptForParsing() or useSubmitManualReading() instead
 * @deprecated
 */
export const useReadingManagement = () => {
  const uploadMutation = useUploadReceiptForParsing();
  const submitMutation = useSubmitManualReading();

  return {
    uploadReceiptForParsing: async (file: File, pumpSno?: string) => {
      if (!pumpSno) throw new Error('Pump serial number is required');
      const result = await uploadMutation.mutateAsync({ file, pumpSno });
      return { success: true, data: result };
    },
    submitManualReading: async (readingData: Omit<ManualReadingData, 'user_id'>) => {
      const result = await submitMutation.mutateAsync(readingData);
      return { success: true, data: result };
    },
    isLoading: uploadMutation.isPending || submitMutation.isPending,
  };
};
