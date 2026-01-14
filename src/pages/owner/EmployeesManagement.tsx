/**
 * Owner Employees Management
 * Manage employees across all stations
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { useStations } from '@/hooks/api';
import { Plus, UserPlus } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'employee' | 'manager';
  stationId: string;
  isActive: boolean;
  createdAt: string;
  station?: {
    id: string;
    name: string;
    code: string;
  };
}

interface EmployeeFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'employee' | 'manager';
  stationId: string;
}

const initialFormData: EmployeeFormData = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'employee',
  stationId: ''
};

// Extract EmployeeForm outside component to prevent recreation on re-renders
interface EmployeeFormProps {
  isEdit?: boolean;
  formData: EmployeeFormData;
  stations?: Array<{ id: string; name: string; code: string }>;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRoleChange: (value: 'employee' | 'manager') => void;
  onStationChange: (value: string) => void;
}

function EmployeeFormContent({
  isEdit = false,
  formData,
  stations,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onPasswordChange,
  onRoleChange,
  onStationChange,
}: EmployeeFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={e => onNameChange(e.target.value)}
            placeholder="John Doe"
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={e => onEmailChange(e.target.value)}
            placeholder="john@example.com"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={e => onPhoneChange(e.target.value)}
            placeholder="+91-9876543210"
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="password">Password {isEdit && '(leave blank to keep current)'}</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={e => onPasswordChange(e.target.value)}
            placeholder={isEdit ? 'Leave blank to keep current' : 'Enter password'}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="role">Role *</Label>
          <Select
            value={formData.role}
            onValueChange={onRoleChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="stationId">Assign to Station *</Label>
          <Select
            value={formData.stationId}
            onValueChange={onStationChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select station" />
            </SelectTrigger>
            <SelectContent>
              {stations?.map((station) => (
                <SelectItem key={station.id} value={station.id}>
                  {station.name} {station.code && `(${station.code})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export default function EmployeesManagement() {
  const [searchParams] = useSearchParams();
  const filterStationId = searchParams.get('station');

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  const [resetPasswordEmployee, setResetPasswordEmployee] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch stations
  const {
    data: stationsResponse
  } = useStations();

  const stations = useMemo(() => (stationsResponse as any)?.data || stationsResponse, [stationsResponse]);

  // Fetch employees
  const { data: employees, isLoading } = useQuery({
    queryKey: ['owner-employees', filterStationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStationId) {
        params.append('stationId', filterStationId);
      }
      params.append('role', 'employee,manager');
      const response = await apiClient.get<Employee[]>(`/users?${params.toString()}`);
      // Extract from nested data property
      return (response as any).data || response;
    }
  });

  // Create employee mutation
  const createMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      const response = await apiClient.post('/users', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-employees'] });
      toast({ title: 'Success', description: 'Employee created successfully', variant: 'success' });
      setIsAddDialogOpen(false);
      setFormData(initialFormData);
    },
    onError: (error: unknown) => {
      let message = 'Failed to create employee';
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const errObj = error as { response?: { data?: { error?: string } } };
        message = errObj.response?.data?.error || message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // Update employee mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EmployeeFormData> }) => {
      const response = await apiClient.put(`/users/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-employees'] });
      toast({ title: 'Success', description: 'Employee updated successfully', variant: 'success' });
      setIsEditDialogOpen(false);
      setEditingEmployee(null);
      setFormData(initialFormData);
    },
    onError: (error: unknown) => {
      let message = 'Failed to update employee';
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const errObj = error as { response?: { data?: { error?: string } } };
        message = errObj.response?.data?.error || message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // Delete employee mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/users/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-employees'] });
      toast({ title: 'Success', description: 'Employee deleted successfully', variant: 'success' });
      setDeleteEmployeeId(null);
    },
    onError: (error: unknown) => {
      let message = 'Failed to delete employee';
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const errObj = error as { response?: { data?: { error?: string } } };
        message = errObj.response?.data?.error || message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const response = await apiClient.post(`/users/${id}/reset-password`, { newPassword: password });
      return response;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Password reset successfully', variant: 'success' });
      setIsResetPasswordDialogOpen(false);
      setResetPasswordEmployee(null);
      setNewPassword('');
    },
    onError: (error: unknown) => {
      let message = 'Failed to reset password';
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const errObj = error as { response?: { data?: { error?: string } } };
        message = errObj.response?.data?.error || message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (editingEmployee) {
      const { password, ...dataToUpdate } = formData;
      updateMutation.mutate({ 
        id: editingEmployee.id, 
        data: password ? formData : dataToUpdate 
      });
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      phone: employee.phone || '',
      password: '',
      role: employee.role,
      stationId: employee.stationId
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteEmployeeId) {
      deleteMutation.mutate(deleteEmployeeId);
    }
  };

  const handleResetPassword = () => {
    if (resetPasswordEmployee && newPassword) {
      resetPasswordMutation.mutate({ id: resetPasswordEmployee.id, password: newPassword });
    }
  };

  const handleResetPasswordDialogOpen = (employee: Employee) => {
    setResetPasswordEmployee(employee);
    setNewPassword('');
    setIsResetPasswordDialogOpen(true);
  };

  const handleResetPasswordDialogClose = () => {
    setIsResetPasswordDialogOpen(false);
    setResetPasswordEmployee(null);
    setNewPassword('');
  };

  const filteredEmployees = useMemo(() => {
    return employees?.filter((emp: Employee) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.station?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);

  const handleAddDialogOpenChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      setFormData(initialFormData);
    }
  };

  const handleEditDialogOpenChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      setEditingEmployee(null);
      setFormData(initialFormData);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employees Management</h1>
          <p className="text-muted-foreground">
            Manage employees and managers across all stations
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>Create a new employee or manager account</DialogDescription>
            </DialogHeader>
            <EmployeeFormContent
              formData={formData}
              stations={stations}
              onNameChange={(value) => setFormData({ ...formData, name: value })}
              onEmailChange={(value) => setFormData({ ...formData, email: value })}
              onPhoneChange={(value) => setFormData({ ...formData, phone: value })}
              onPasswordChange={(value) => setFormData({ ...formData, password: value })}
              onRoleChange={(value) => setFormData({ ...formData, role: value })}
              onStationChange={(value) => setFormData({ ...formData, stationId: value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={!formData.name || !formData.email || !formData.stationId || !formData.password || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Employee'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="Search by name, email, or station..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            {filterStationId && (
              <Badge variant="secondary" className="px-4 py-2">
                Filtered by station
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Employees List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">Loading employees...</div>
          </CardContent>
        </Card>
      ) : filteredEmployees && filteredEmployees.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEmployees.map((employee: Employee) => (
            // Redesigned employee cards for better visibility on laptops
            <Card key={employee.id} className="flex-1 overflow-hidden min-w-[300px] md:min-w-[400px] xl:min-w-[500px]">
              <CardContent className="p-6">
                <div className="text-lg md:text-xl font-bold text-primary truncate">{employee.name}</div>
                <div className="text-sm md:text-base text-muted-foreground truncate">{employee.email}</div>
                <div className="text-sm md:text-base text-muted-foreground truncate">{employee.phone || 'N/A'}</div>
                <div className="text-sm md:text-base text-muted-foreground truncate">Role: {employee.role}</div>
                <div className="text-sm md:text-base text-muted-foreground truncate">Station: {employee.station?.name || 'Unassigned'}</div>
                <div className="flex gap-4 mt-6">
                  <Button
                    variant="default"
                    size="sm"
                    className="px-4 py-2 rounded-lg shadow-md"
                    onClick={() => handleEdit(employee)}
                  >
                    Edit Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-4 py-2 rounded-lg shadow-md"
                    onClick={() => handleResetPasswordDialogOpen(employee)}
                  >
                    Reset Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <UserPlus className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">No Employees Yet</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'No employees match your search' : 'Get started by adding your first employee'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Employee
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update employee information</DialogDescription>
          </DialogHeader>
          <EmployeeFormContent
            isEdit
            formData={formData}
            stations={stations}
            onNameChange={(value) => setFormData({ ...formData, name: value })}
            onEmailChange={(value) => setFormData({ ...formData, email: value })}
            onPhoneChange={(value) => setFormData({ ...formData, phone: value })}
            onPasswordChange={(value) => setFormData({ ...formData, password: value })}
            onRoleChange={(value) => setFormData({ ...formData, role: value })}
            onStationChange={(value) => setFormData({ ...formData, stationId: value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate}
              disabled={!formData.name || !formData.email || !formData.stationId || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Updating...' : 'Update Employee'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEmployeeId} onOpenChange={() => setDeleteEmployeeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this employee? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={handleResetPasswordDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset the password for {resetPasswordEmployee?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Password must be at least 6 characters long
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleResetPasswordDialogClose}>
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={!newPassword || newPassword.length < 6 || resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
