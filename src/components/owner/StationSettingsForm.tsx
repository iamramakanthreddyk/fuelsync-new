import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { AlertCircle, Check } from 'lucide-react';

interface StationSettingsFormProps {
  stationId: string;
}

interface StationSettings {
  success: boolean;
  data: {
    id: string;
    name: string;
    settings: {
      requireShiftForReadings: boolean;
      alertOnMissedReadings: boolean;
      missedReadingThresholdDays: number;
    };
  };
}

export function StationSettingsForm({ stationId }: StationSettingsFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current settings
  const { data: settingsResponse, isLoading } = useQuery<StationSettings | null>({
    queryKey: ['station-settings', stationId],
    queryFn: async () => {
      try {
        const response = await apiClient.get<StationSettings>(`/stations/${stationId}/settings`);
        return response ?? null;
      } catch (error) {
        return null;
      }
    },
    enabled: !!stationId
  });

  const settings = settingsResponse?.data?.settings;

  // Local state for form
  const [formData, setFormData] = useState({
    requireShiftForReadings: false,
    alertOnMissedReadings: false,
    missedReadingThresholdDays: 7
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        requireShiftForReadings: settings.requireShiftForReadings ?? false,
        alertOnMissedReadings: settings.alertOnMissedReadings ?? false,
        missedReadingThresholdDays: settings.missedReadingThresholdDays ?? 7
      });
    }
  }, [settings]);

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiClient.put<StationSettings>(
        `/stations/${stationId}/settings`,
        data
      );
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Settings Updated',
        description: 'Station settings have been saved successfully',
        duration: 3000
      });
      queryClient.invalidateQueries({ queryKey: ['station-settings', stationId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update settings',
        variant: 'destructive',
        duration: 3000
      });
    }
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync(formData);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading settings...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Reading Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reading Requirements</CardTitle>
          <CardDescription>Configure how readings are managed at this station</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <div className="flex-1">
              <Label className="text-base font-semibold cursor-pointer">
                Require Shift Assignment
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Require employees to assign a shift when recording readings
              </p>
            </div>
            <Switch
              checked={formData.requireShiftForReadings}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, requireShiftForReadings: checked })
              }
              className="ml-4"
            />
          </div>
        </CardContent>
      </Card>

      {/* Missed Reading Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Missed Reading Alerts</CardTitle>
          <CardDescription>Get notified when readings are not recorded on time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
            <div className="flex-1">
              <Label className="text-base font-semibold cursor-pointer">
                Enable Alerts
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Send alerts when readings are overdue
              </p>
            </div>
            <Switch
              checked={formData.alertOnMissedReadings}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, alertOnMissedReadings: checked })
              }
              className="ml-4"
            />
          </div>

          {formData.alertOnMissedReadings && (
            <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-950/20">
              <Label htmlFor="threshold" className="text-base font-semibold">
                Alert After (Days)
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Number of days before sending a missed reading alert (1-30 days)
              </p>
              <div className="flex items-center gap-2">
                <Input
                  id="threshold"
                  type="number"
                  min="1"
                  max="30"
                  value={formData.missedReadingThresholdDays}
                  onChange={(e) => {
                    const value = Math.max(1, Math.min(30, parseInt(e.target.value) || 7));
                    setFormData({ ...formData, missedReadingThresholdDays: value });
                  }}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Alert will trigger if no reading is recorded for more than {formData.missedReadingThresholdDays} days</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving || updateMutation.isPending}
          className="gap-2"
        >
          {isSaving || updateMutation.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
