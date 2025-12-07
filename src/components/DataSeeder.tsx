
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiClient, ApiResponse } from '@/lib/api-client';
import { Loader2, Database, CheckCircle, AlertCircle } from 'lucide-react';

export default function DataSeeder() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const seedDatabase = async () => {
    try {
      setIsSeeding(true);
      setSeedStatus('idle');

      const response = await apiClient.post<ApiResponse<unknown>>('/admin/seed', { action: 'seed' });

      if (!response.success) {
        throw new Error(response.message || 'Failed to seed database');
      }

      setSeedStatus('success');
      toast({
        title: 'Success!',
        description: response.message || 'Database seeded successfully',
        variant: 'default'
      });
      
    } catch (error) {
      console.error('❌ Seeding failed:', error);
      setSeedStatus('error');
      toast({
        title: 'Seeding Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const getStatusIcon = () => {
    switch (seedStatus) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Database className="h-4 w-4 text-blue-600" />;
    }
  };

  const getButtonText = () => {
    if (isSeeding) return 'Seeding...';
    if (seedStatus === 'success') return 'Database Ready';
    return 'Seed Database';
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {getStatusIcon()}
          Database Setup
        </CardTitle>
        <CardDescription className="text-xs">
          Initialize the database with sample fuel station data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={seedDatabase}
          disabled={isSeeding || seedStatus === 'success'}
          size="sm"
          className="w-full"
          variant={seedStatus === 'success' ? 'secondary' : 'default'}
        >
          {isSeeding && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          {getButtonText()}
        </Button>
        
        {seedStatus === 'success' && (
          <p className="text-xs text-green-600 mt-2 text-center">
            ✅ Ready to login with demo accounts
          </p>
        )}
        
        {seedStatus === 'error' && (
          <p className="text-xs text-red-600 mt-2 text-center">
            ❌ Check console for details
          </p>
        )}
      </CardContent>
    </Card>
  );
}
