
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiClient, ApiResponse } from '@/lib/api-client';
import { Plus, Building2, UserPlus } from 'lucide-react';

const OwnerDashboard = () => {
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [newPump, setNewPump] = useState({
    pumpSno: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [pumpDialogOpen, setPumpDialogOpen] = useState(false);
  
  const { user } = useAuth();
  const currentStation = user?.stations?.[0];

  useEffect(() => {
    if (!user || user.role !== 'owner') {
      window.location.href = '/';
    }
  }, [user]);

  const handleCreateEmployee = async () => {
    if (!currentStation) return;
    
    try {
      setLoading(true);
      
      const response = await apiClient.post<{ success: boolean; data: unknown }>('/users', {
        name: newEmployee.name,
        email: newEmployee.email,
        phone: newEmployee.phone,
        password: newEmployee.password,
        role: 'employee',
        isActive: true,
        stationId: currentStation.id
      });

      toast({
        title: 'Success',
        description: 'Employee created successfully'
      });
      setEmployeeDialogOpen(false);
      setNewEmployee({ name: '', email: '', phone: '', password: '' });
    } catch (error) {
      console.error('Error creating employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to create employee',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePump = async () => {
    if (!currentStation) return;
    
    try {
      setLoading(true);
      
      const response = await apiClient.post<{ success: boolean; data: unknown }>(`/stations/${currentStation.id}/pumps`, {
        number: newPump.pumpSno,
        name: newPump.name,
        status: 'active'
      });

      toast({
        title: 'Success',
        description: 'Pump created successfully'
      });
      setPumpDialogOpen(false);
      setNewPump({ pumpSno: '', name: '' });
    } catch (error) {
      console.error('Error creating pump:', error);
      toast({
        title: 'Error',
        description: 'Failed to create pump',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!currentStation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="text-center">
            <CardTitle>No Station Assigned</CardTitle>
            <CardDescription>
              Please contact your administrator to assign a station to your account.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Owner Dashboard</h1>
          <p className="text-muted-foreground">Manage your fuel station operations</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEmployeeDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
          <Button onClick={() => setPumpDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Pump
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Station Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Name:</strong> {currentStation.name}</p>
              <p><strong>Brand:</strong> {currentStation.brand}</p>
              <p><strong>Address:</strong> {currentStation.address || 'Not specified'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>Employees: 0</p>
              <p>Active Pumps: 0</p>
              <p>Today's Sales: ₹0</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No recent activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Add Employee Dialog */}
      {employeeDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add New Employee</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newEmployee.password}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateEmployee} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Employee'}
                </Button>
                <Button variant="outline" onClick={() => setEmployeeDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Pump Dialog */}
      {pumpDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add New Pump</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="pumpSno">Pump Serial Number</Label>
                <Input
                  id="pumpSno"
                  value={newPump.pumpSno}
                  onChange={(e) => setNewPump(prev => ({ ...prev, pumpSno: e.target.value }))}
                  placeholder="e.g., P001"
                />
              </div>
              <div>
                <Label htmlFor="pumpName">Pump Name</Label>
                <Input
                  id="pumpName"
                  value={newPump.name}
                  onChange={(e) => setNewPump(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Main Pump 1"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreatePump} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Pump'}
                </Button>
                <Button variant="outline" onClick={() => setPumpDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OwnerDashboard;
