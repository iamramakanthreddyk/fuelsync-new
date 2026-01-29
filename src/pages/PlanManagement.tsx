import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import RequireAdmin from '@/components/auth/RequireAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  maxStations: number;
  maxPumpsPerStation: number;
  maxNozzlesPerPump: number;
  maxEmployees: number;
  isActive: boolean;
  features: Record<string, boolean>;
}

function PlanManagement() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Plan>>({});
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<{ success: boolean; data: Plan[] }>('/plans');
        const arr = (res as unknown as { data?: Plan[] })?.data ?? (res as unknown as Plan[]);
        setPlans(arr as Plan[]);
      } catch (err) {
      }
    })();
  }, []);

  const handleEdit = (plan: Plan) => {
    setEditing(plan.id);
    setEditData({ ...plan });
  };

  const handleCancel = () => {
    setEditing(null);
    setEditData({});
  };

  const handleChange = (field: keyof Plan, value: string | number | boolean) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleFeatureToggle = (feature: string) => {
    setEditData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: !prev.features?.[feature]
      }
    }));
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const updatedRes = await apiClient.put<{ success: boolean; data: Plan }>(`/plans/${editing}`, editData);
      const updated = (updatedRes as unknown as { data?: Plan })?.data ?? (updatedRes as unknown as Plan);
      toast({ title: 'Plan updated' });
      setPlans(plans => plans.map(p => p.id === editing ? updated : p));
      setEditing(null);
      setEditData({});
    } catch (err) {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
  };


  return (
    <RequireAdmin>
      <div className="max-w-3xl mx-auto py-8 space-y-6">
        <h1 className="text-2xl font-bold mb-4">Plan Management</h1>
        {plans.map(plan => (
          <Card key={plan.id} className="mb-4">
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {editing === plan.id ? (
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editData.name || ''} onChange={e => handleChange('name', e.target.value)} />
                  <Label>Description</Label>
                  <Input value={editData.description || ''} onChange={e => handleChange('description', e.target.value)} />
                  <Label>Monthly Price</Label>
                  <Input type="number" value={editData.priceMonthly ?? ''} onChange={e => handleChange('priceMonthly', Number(e.target.value))} />
                  <Label>Yearly Price</Label>
                  <Input type="number" value={editData.priceYearly ?? ''} onChange={e => handleChange('priceYearly', Number(e.target.value))} />
                  <Label>Max Stations</Label>
                  <Input type="number" value={editData.maxStations ?? ''} onChange={e => handleChange('maxStations', Number(e.target.value))} />
                  <Label>Max Pumps/Station</Label>
                  <Input type="number" value={editData.maxPumpsPerStation ?? ''} onChange={e => handleChange('maxPumpsPerStation', Number(e.target.value))} />
                  <Label>Max Nozzles/Pump</Label>
                  <Input type="number" value={editData.maxNozzlesPerPump ?? ''} onChange={e => handleChange('maxNozzlesPerPump', Number(e.target.value))} />
                  <Label>Max Employees</Label>
                  <Input type="number" value={editData.maxEmployees ?? ''} onChange={e => handleChange('maxEmployees', Number(e.target.value))} />
                  <div className="flex items-center gap-2 mt-2">
                    <Label>Active</Label>
                    <Switch checked={!!editData.isActive} onCheckedChange={v => handleChange('isActive', v)} />
                  </div>
                  <div className="mt-2">
                    <Label>Features</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Object.keys(plan.features || {}).map(f => (
                        <div key={f} className="flex items-center gap-1">
                          <Switch checked={!!editData.features?.[f]} onCheckedChange={() => handleFeatureToggle(f)} />
                          <span className="text-xs">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleSave}>Save</Button>
                    <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div><b>Description:</b> {plan.description}</div>
                  <div><b>Monthly:</b> ₹{plan.priceMonthly} &nbsp; <b>Yearly:</b> ₹{plan.priceYearly}</div>
                  <div><b>Max Stations:</b> {plan.maxStations} &nbsp; <b>Pumps/Station:</b> {plan.maxPumpsPerStation} &nbsp; <b>Nozzles/Pump:</b> {plan.maxNozzlesPerPump}</div>
                  <div><b>Max Employees:</b> {plan.maxEmployees}</div>
                  <div><b>Active:</b> {plan.isActive ? 'Yes' : 'No'}</div>
                  <div className="mt-1"><b>Features:</b> {Object.entries(plan.features || {}).filter(([k,v]) => v).map(([k]) => k).join(', ')}</div>
                  <Button className="mt-2" onClick={() => handleEdit(plan)}>Edit</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </RequireAdmin>
  );
}

export default PlanManagement;
