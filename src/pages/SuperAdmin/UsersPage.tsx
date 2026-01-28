import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from '@/lib/errorUtils';
import { apiClient } from "@/lib/api";
import { useAuth } from '@/hooks/useAuth';
import type { User, Station, Plan } from '@/types/api';
import { Users, Plus, Search, Edit, Trash2, UserCheck, UserX, Crown, Building2, Briefcase, User as UserIcon } from "lucide-react";

// Using canonical `User`, `Station`, and `Plan` types from `src/types/api.ts`

interface Props {
  stations?: Station[];
}

import { ROLE_ICONS } from '@/lib/constants';

import { getRoleBadgeClasses, getStatusBadgeClasses } from '@/lib/badgeColors';

const UsersPage = ({ stations: propStations = [] }: Props) => {
  const [users, setUsers] = useState<User[]>([]);
  const [stations, setStations] = useState<Station[]>(propStations);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'employee' as User['role'],
    password: '',
    stationId: '',
    planId: '' // Will be set to basic plan by default
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  
  // Edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    role: 'employee' as User['role'],
    stationId: '',
    planId: '',
    isActive: true,
    newPassword: ''
  });
  
  const { toast } = useToast();

  const { isAuthenticated, loading: authLoading, user } = useAuth();

  // Role creation permissions based on backend rules
  const getCreatableRoles = () => {
    const currentRole = user?.role?.toLowerCase() || '';
    const creationRules: Record<string, string[]> = {
      'super_admin': ['owner'],
      'owner': ['manager', 'employee'],
      'manager': ['employee'],
      'employee': []
    };
    return creationRules[currentRole] || [];
  };

  const creatableRoles = getCreatableRoles();

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const rawResponses = await Promise.all([
            apiClient.get('/users'),
            apiClient.get('/stations'),
            apiClient.get('/plans')
          ] as unknown[]);

          const [usersResRaw, stationsResRaw, plansResRaw] = rawResponses as any[];

          // Normalize responses: apiClient may return an envelope { success, data } or the raw payload
          const normalize = (res: any) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

          const usersRes = normalize(usersResRaw) || [];
          const stationsRes = normalize(stationsResRaw) || [];
          const plansRes = normalize(plansResRaw) || [];

          setUsers(Array.isArray(usersRes) ? usersRes : []);
          setStations(Array.isArray(stationsRes) ? stationsRes : []);
          setPlans(Array.isArray(plansRes) ? plansRes : []);
        } catch (error: unknown) {
          const message = getErrorMessage(error);
          console.error('Error fetching data:', message);
          toast({
            title: "Error",
            description: message,
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [isAuthenticated, authLoading, toast]);

  const resetCreateForm = () => {
    // Set default role to first creatable role
    const defaultRole = creatableRoles.length > 0 ? creatableRoles[0] : 'employee';
    setCreateForm({
      name: '',
      email: '',
      phone: '',
      role: defaultRole as User['role'],
      password: '',
      stationId: '',
      planId: ''
    });
    setCreateErrors({});
  };

  // Validation function for create form
  const validateCreateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const trim = (v?: string) => (v || '').trim();

    // Name validation: required, 1-100 chars
    if (!trim(createForm.name)) {
      errors.name = 'Name is required';
    } else if (trim(createForm.name).length < 2) {
      errors.name = 'Name must be at least 2 characters';
    } else if (trim(createForm.name).length > 100) {
      errors.name = 'Name must be less than 100 characters';
    }

    // Email validation: required, valid format
    const email = trim(createForm.email);
    if (!email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address';
    }

    // Password validation: required, min 8 chars, uppercase, lowercase, number
    const password = createForm.password;
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/[a-z]/.test(password)) {
      errors.password = 'Password must contain a lowercase letter';
    } else if (!/[A-Z]/.test(password)) {
      errors.password = 'Password must contain an uppercase letter';
    } else if (!/\d/.test(password)) {
      errors.password = 'Password must contain a number';
    }

    // Phone validation: optional, but if provided must be 10 digits or 12 digits starting with 91
    const phone = trim(createForm.phone);
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length !== 10 && !(digits.length === 12 && digits.startsWith('91'))) {
        errors.phone = 'Enter a valid 10-digit phone number';
      }
    }

    // Role validation
    if (!createForm.role) {
      errors.role = 'Role is required';
    }

    // Station required for manager/employee
    if ((createForm.role === 'manager' || createForm.role === 'employee') && !createForm.stationId) {
      errors.stationId = 'Station is required for manager/employee';
    }

    // Plan required for owner
    if (createForm.role === 'owner' && !createForm.planId) {
      const basicPlan = plans.find(p => p.name.toLowerCase() === 'basic' || p.name.toLowerCase() === 'free');
      if (!basicPlan) {
        errors.planId = 'Please select a plan for the owner';
      }
    }

    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateUser = async () => {
    // Run client-side validation
    if (!validateCreateForm()) {
      return;
    }

    // Fallback to 'basic' or 'free' plan if owner and no plan selected
    let planIdToUse = createForm.planId;
    if (createForm.role === 'owner' && !planIdToUse) {
      const basicPlan = plans.find(p => p.name.toLowerCase() === 'basic' || p.name.toLowerCase() === 'free');
      if (basicPlan) {
        planIdToUse = basicPlan.id;
      }
    }

    try {
      setIsCreating(true);
      const payload: Record<string, unknown> = {
        name: createForm.name,
        email: createForm.email,
        phone: createForm.phone || undefined,
        role: createForm.role,
        password: createForm.password || 'changeme123'
      };

      if (createForm.role === 'manager' || createForm.role === 'employee') {
        payload.stationId = createForm.stationId;
      }

      if (createForm.role === 'owner') {
        payload.planId = planIdToUse;
      }

      await apiClient.post('/users', payload);

      toast({ title: "Success", description: "User created successfully", variant: "success" });
      setIsCreateOpen(false);
      resetCreateForm();
      fetchData();
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      stationId: user.stationId || (user.stations && user.stations[0]?.id) || '',
      planId: user.planId || user.plan?.id || '',
      isActive: user.isActive,
      newPassword: ''
    });
    setIsEditOpen(true);
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      setIsUpdating(true);
      const payload: Record<string, unknown> = {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone || undefined,
        role: editForm.role,
        isActive: editForm.isActive
      };

      if (editForm.role === 'manager' || editForm.role === 'employee') {
        payload.stationId = editForm.stationId || undefined;
      }

      if (editForm.role === 'owner') {
        payload.planId = editForm.planId || undefined;
      }

      await apiClient.put(`/users/${selectedUser.id}`, payload);

      toast({ title: "Success", description: "User updated successfully", variant: "success" });
      setIsEditOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await apiClient.delete(`/users/${userId}`);
      toast({ title: "Success", description: "User deleted successfully", variant: "success" });
      fetchData();
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await apiClient.put(`/users/${user.id}`, { isActive: !user.isActive });
      toast({ title: "Success", description: `User ${user.isActive ? 'deactivated' : 'activated'} successfully`, variant: "success" });
      fetchData();
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role: User['role']) => {
    const Icon = ROLE_ICONS[role] || UserIcon;
    return <Icon className="h-4 w-4" />;
  };

  // Mobile Card Component
  const UserCard = ({ user }: { user: User }) => (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{user.name}</span>
              <Badge variant="outline" className={getStatusBadgeClasses(user.isActive ? 'active' : 'inactive')}>
                {user.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
            
            <div className="flex flex-wrap gap-2 mb-2">
              <RoleBadge role={user.role} size="sm" />
              
              {user.role === 'owner' && user.plan && (
                <Badge variant="secondary">
                  Plan: {user.plan.name}
                </Badge>
              )}
              
              {(user.role === 'manager' || user.role === 'employee') && (
                <Badge variant="secondary">
                  Station: {user.stations?.find(s => s.id === user.stationId)?.name || 'Not assigned'}
                </Badge>
              )}
              
              {user.role === 'owner' && user.stations && user.stations.length > 0 && (
                <Badge variant="outline">
                  {user.stations.length} station(s)
                </Badge>
              )}
            </div>
            
            {user.phone && (
              <p className="text-sm text-muted-foreground">📞 {user.phone}</p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={() => openEditDialog(user)} className="flex-1">
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleToggleStatus(user)}
            className="flex-1"
          >
            {user.isActive ? <UserX className="h-4 w-4 mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />}
            {user.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete User</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {user.name}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-2 md:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Users Management</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage users and their plan assignments
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system. Owners get plans, staff get station assignments.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={createForm.name}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, name: e.target.value });
                    if (createErrors.name) setCreateErrors({ ...createErrors, name: '' });
                  }}
                  placeholder="Enter user name"
                  className={createErrors.name ? 'border-red-500' : ''}
                />
                {createErrors.name && <p className="text-sm text-red-500 mt-1">{createErrors.name}</p>}
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, email: e.target.value });
                    if (createErrors.email) setCreateErrors({ ...createErrors, email: '' });
                  }}
                  placeholder="Enter email address"
                  className={createErrors.email ? 'border-red-500' : ''}
                />
                {createErrors.email && <p className="text-sm text-red-500 mt-1">{createErrors.email}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={createForm.phone}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, phone: e.target.value });
                    if (createErrors.phone) setCreateErrors({ ...createErrors, phone: '' });
                  }}
                  placeholder="10-digit phone number"
                  className={createErrors.phone ? 'border-red-500' : ''}
                />
                {createErrors.phone && <p className="text-sm text-red-500 mt-1">{createErrors.phone}</p>}
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, password: e.target.value });
                    if (createErrors.password) setCreateErrors({ ...createErrors, password: '' });
                  }}
                  placeholder="Min 8 chars, uppercase, lowercase, number"
                  className={createErrors.password ? 'border-red-500' : ''}
                />
                {createErrors.password && <p className="text-sm text-red-500 mt-1">{createErrors.password}</p>}
                <p className="text-xs text-muted-foreground mt-1">Must contain uppercase, lowercase, and a number</p>
              </div>
              <div>
                <Label htmlFor="role">Role *</Label>
                <Select 
                  value={createForm.role}
                  onValueChange={(value) => {
                    setCreateForm({
                      ...createForm,
                      role: value as User['role'],
                      stationId: '',
                      planId: '' // Do not auto-set planId, let user pick
                    });
                    if (createErrors.role) setCreateErrors({ ...createErrors, role: '' });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {creatableRoles.includes('super_admin') && (
                      <SelectItem value="super_admin">
                        <span className="flex items-center gap-2">
                          <Crown className="h-4 w-4" /> Super Admin
                        </span>
                      </SelectItem>
                    )}
                    {creatableRoles.includes('owner') && (
                      <SelectItem value="owner">
                        <span className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" /> Owner (can create stations)
                        </span>
                      </SelectItem>
                    )}
                    {creatableRoles.includes('manager') && (
                      <SelectItem value="manager">
                        <span className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" /> Manager
                        </span>
                      </SelectItem>
                    )}
                    {creatableRoles.includes('employee') && (
                      <SelectItem value="employee">
                        <span className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4" /> Employee
                        </span>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {creatableRoles.length === 0 && (
                  <p className="text-sm text-amber-600 mt-1">You don't have permission to create users</p>
                )}
              </div>

              {/* Plan selection for owners */}
              {createForm.role === 'owner' && (
                <div>
                  <Label htmlFor="plan">Subscription Plan *</Label>
                  <Select 
                    value={createForm.planId} 
                    onValueChange={(value) => {
                      setCreateForm({ ...createForm, planId: value });
                      if (createErrors.planId) setCreateErrors({ ...createErrors, planId: '' });
                    }}
                  >
                    <SelectTrigger className={createErrors.planId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          <div className="flex flex-col">
                            <span>{plan.name} - ₹{plan.priceMonthly}/month</span>
                            <span className="text-xs text-muted-foreground">
                              Max {plan.maxStations} stations, {plan.maxEmployees} employees
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {createErrors.planId && <p className="text-sm text-red-500 mt-1">{createErrors.planId}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Plan determines limits for stations, pumps, employees, etc.
                  </p>
                </div>
              )}

              {/* Station selection for manager/employee */}
              {(createForm.role === 'manager' || createForm.role === 'employee') && (
                <div>
                  <Label htmlFor="station">Assigned Station *</Label>
                  <Select 
                    value={createForm.stationId} 
                    onValueChange={(value) => {
                      setCreateForm({ ...createForm, stationId: value });
                      if (createErrors.stationId) setCreateErrors({ ...createErrors, stationId: '' });
                    }}
                  >
                    <SelectTrigger className={createErrors.stationId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Array.isArray(stations) ? stations : []).map((station) => (
                        <SelectItem key={station.id} value={station.id}>
                          {station.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {createErrors.stationId && <p className="text-sm text-red-500 mt-1">{createErrors.stationId}</p>}
                </div>
              )}

              {createForm.role === 'super_admin' && (
                <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  ⚠️ Super admins have full platform access
                </p>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetCreateForm(); }} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={handleCreateUser} disabled={isCreating} className="w-full sm:w-auto">
                {isCreating ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users
          </CardTitle>
          <CardDescription>
            Total users: {users.length} | Showing: {filteredUsers.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          ) : (
            <>
              {/* Mobile View - Cards */}
              <div className="block md:hidden">
                {filteredUsers.map((user) => (
                  <UserCard key={user.id} user={user} />
                ))}
              </div>

              {/* Desktop View - Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Plan / Station</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                            {user.phone && <div className="text-xs text-muted-foreground">{user.phone}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={user.role} size="sm" />
                        </TableCell>
                        <TableCell>
                          {user.role === 'owner' && (
                            <div>
                              <Badge variant="secondary">
                                {user.plan?.name || 'No plan'}
                              </Badge>
                              {user.stations && user.stations.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {user.stations.length} station(s) owned
                                </div>
                              )}
                            </div>
                          )}
                          {(user.role === 'manager' || user.role === 'employee') && (
                            <Badge variant="outline">
                              {user.stations?.find(s => s.id === user.stationId)?.name || 'Not assigned'}
                            </Badge>
                          )}
                          {(user.role === 'super_admin') && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusBadgeClasses(user.isActive ? 'active' : 'inactive')}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleToggleStatus(user)}
                            >
                              {user.isActive ? <UserX className="h-4 w-4 mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                              {user.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {user.name}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and assignments
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editForm.role} onValueChange={(value) => setEditForm({ ...editForm, role: value as User['role'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Plan selection for owners */}
            {editForm.role === 'owner' && (
              <div>
                <Label htmlFor="edit-plan">Subscription Plan</Label>
                <Select value={editForm.planId} onValueChange={(value) => setEditForm({ ...editForm, planId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - ₹{plan.priceMonthly}/month
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Station selection for manager/employee */}
            {(editForm.role === 'manager' || editForm.role === 'employee') && (
              <div>
                <Label htmlFor="edit-station">Assigned Station</Label>
                <Select value={editForm.stationId} onValueChange={(value) => setEditForm({ ...editForm, stationId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select station" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(stations) ? stations : []).map((station) => (
                      <SelectItem key={station.id} value={station.id}>
                        {station.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Status</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={editForm.isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditForm({ ...editForm, isActive: true })}
                >
                  <UserCheck className="h-4 w-4 mr-1" /> Active
                </Button>
                <Button
                  type="button"
                  variant={!editForm.isActive ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setEditForm({ ...editForm, isActive: false })}
                >
                  <UserX className="h-4 w-4 mr-1" /> Inactive
                </Button>
              </div>
            </div>
              {/* Password reset/change for super admin */}
              {user && user.role === 'super_admin' && (
                <div>
                  <Label htmlFor="edit-password">Change Password</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={editForm.newPassword || ''}
                    onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                    placeholder="Enter new password"
                  />
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="mt-2"
                    onClick={async () => {
                      if (!editForm.newPassword || editForm.newPassword.length < 6) {
                        toast({ title: "Error", description: 'Password must be at least 6 characters', variant: "destructive" });
                        return;
                      }
                      try {
                        await apiClient.post(`/users/${editForm.id}/reset-password`, { newPassword: editForm.newPassword });
                        toast({ title: "Success", description: "Password changed successfully", variant: "success" });
                        setEditForm({ ...editForm, newPassword: '' });
                      } catch (err) {
                        toast({ title: "Error", description: "Failed to change password", variant: "destructive" });
                      }
                    }}
                  >
                    Change Password
                  </Button>
                </div>
              )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleEditUser} disabled={isUpdating} className="w-full sm:w-auto">
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
