/**
 * Owner Employees Management
 * Manage employees across all stations
 */

import React from 'react';
import { useState } from 'react';
import { debounce } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, UserPlus, Edit, Trash2, Mail, Phone, Building2, Shield } from 'lucide-react';

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

interface Station {
  id: string;
  name: string;
  code: string;
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

export default function EmployeesManagement() {
    // Debounced handlers for text fields
    const debouncedSetName = React.useRef(
      debounce((...args: unknown[]) => {
        const value = args[0] as string;
        setFormData((prev) => ({ ...prev, name: value }));
      }, 200)
    ).current;
    const debouncedSetEmail = React.useRef(
      debounce((...args: unknown[]) => {
        const value = args[0] as string;
        setFormData((prev) => ({ ...prev, email: value }));
      }, 200)
    ).current;
    const debouncedSetPhone = React.useRef(
      debounce((...args: unknown[]) => {
        const value = args[0] as string;
        setFormData((prev) => ({ ...prev, phone: value }));
      }, 200)
    ).current;
    const debouncedSetPassword = React.useRef(
      debounce((...args: unknown[]) => {
        const value = args[0] as string;
        setFormData((prev) => ({ ...prev, password: value }));
      }, 200)
    ).current;
  const [searchParams] = useSearchParams();
  const filterStationId = searchParams.get('station');

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch stations
  const { data: stations } = useQuery({
    queryKey: ['owner-stations'],
    queryFn: async () => {
      const response = await apiClient.get<Station[]>('/stations');
      return response;
    }
  });

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
      return response;
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
      toast({ title: 'Success', description: 'Employee created successfully' });
      setIsAddDialogOpen(false);
      setFormData(initialFormData);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create employee',
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
      toast({ title: 'Success', description: 'Employee updated successfully' });
      setIsEditDialogOpen(false);
      setEditingEmployee(null);
      setFormData(initialFormData);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to update employee',
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
      toast({ title: 'Success', description: 'Employee deleted successfully' });
      setDeleteEmployeeId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete employee',
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

  const filteredEmployees = employees?.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.station?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const EmployeeForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={e => debouncedSetName(e.target.value)}
            placeholder="John Doe"
          />
        </div>
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={e => debouncedSetEmail(e.target.value)}
            placeholder="john@example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={e => debouncedSetPhone(e.target.value)}
            placeholder="+91-9876543210"
          />
        </div>
        <div>
          <Label htmlFor="password">Password {isEdit && '(leave blank to keep current)'}</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={e => debouncedSetPassword(e.target.value)}
            placeholder={isEdit ? 'Leave blank to keep current' : 'Enter password'}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="role">Role *</Label>
          <Select
            value={formData.role}
            onValueChange={(value: any) => setFormData({ ...formData, role: value })}
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
            onValueChange={(value) => setFormData({ ...formData, stationId: value })}
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
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
            <EmployeeForm />
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
          {filteredEmployees.map((employee) => (
            <Card key={employee.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{employee.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={employee.role === 'manager' ? 'default' : 'secondary'}>
                        <Shield className="w-3 h-3 mr-1" />
                        {employee.role}
                      </Badge>
                      <Badge variant={employee.isActive ? 'default' : 'outline'}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Contact */}
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate">{employee.email}</span>
                  </div>
                  {employee.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{employee.phone}</span>
                    </div>
                  )}
                </div>

                {/* Station */}
                {employee.station && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate">
                      {employee.station.name}
                      {employee.station.code && ` (${employee.station.code})`}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(employee)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteEmployeeId(employee.id)}
                  >
                    <Trash2 className="w-4 h-4" />
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
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update employee information</DialogDescription>
          </DialogHeader>
          <EmployeeForm isEdit />
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
    </div>
  );
}
