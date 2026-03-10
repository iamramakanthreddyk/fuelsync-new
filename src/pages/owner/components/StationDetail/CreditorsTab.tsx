import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, CreditCard, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { extractApiArray } from '@/lib/api-response';
import CreditorCard from './cards/CreditorCard';
import { PermissionGuard } from '@/hooks/usePermissions';

interface Creditor {
  id: string;
  name: string;
  phone: string;
  email?: string;
  creditLimit: number;
  currentBalance: number;
  vehicleNumber?: string;
}

interface CreditorsTabProps {
  id: string;
}

export default function CreditorsTab({ id }: CreditorsTabProps) {
  const queryClient = useQueryClient();
  const [settleOpenId, setSettleOpenId] = useState<string | null>(null);

  // Fetch creditors
  const { data: creditors, isLoading: creditorsLoading } = useQuery({
    queryKey: ['station-creditors', id],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ success: boolean; data: Creditor[] }>(`/stations/${id}/creditors`);
        return extractApiArray(response, []);
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          typeof (error as { response?: { status?: number } }).response === 'object' &&
          (error as { response?: { status?: number } }).response?.status === 404
        ) {
          return [];
        }
        throw error;
      }
    },
    enabled: !!id
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Credit Customers</h2>
        <Link to={`/owner/stations/${id}/add-creditor`}>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Creditor
          </Button>
        </Link>
      </div>

      {creditorsLoading ? (
        <div className="text-center py-6">Loading creditors...</div>
      ) : creditors && creditors.length > 0 ? (
        <div className="grid gap-4">
          {creditors.map((creditor: Creditor) => (
            <CreditorCard
              key={creditor.id}
              creditor={creditor}
              isSettleOpen={settleOpenId === creditor.id}
              onSettleToggle={() => setSettleOpenId(settleOpenId === creditor.id ? null : creditor.id)}
              onSettleSuccess={() => {
                setSettleOpenId(null);
                queryClient.invalidateQueries({ queryKey: ['station-creditors', id] });
              }}
              stationId={id}
            />
          ))}
        </div>
      ) : creditors && creditors.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No creditors added yet</p>
            <PermissionGuard roles={["manager","owner","super_admin"]} permission="manage_creditors" fallback={<Button disabled><Plus className="w-4 h-4 mr-2"/>Add First Creditor</Button>}>
              <Link to={`/owner/stations/${id}/add-creditor`}>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Creditor
                </Button>
              </Link>
            </PermissionGuard>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <p className="text-muted-foreground mb-4">All credits are settled - no outstanding balances</p>
            <PermissionGuard roles={["manager","owner","super_admin"]} permission="manage_creditors" fallback={<Button variant="outline" disabled><Plus className="w-4 h-4 mr-2"/>Add New Creditor</Button>}>
              <Link to={`/owner/stations/${id}/add-creditor`}>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Creditor
                </Button>
              </Link>
            </PermissionGuard>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
