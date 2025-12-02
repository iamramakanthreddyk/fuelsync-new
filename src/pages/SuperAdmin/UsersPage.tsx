import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Users, Plus, Search, Edit, Trash2, UserCheck, UserX, Crown, Building2, Briefcase, User as UserIcon } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'super_admin' | 'owner' | 'manager' | 'employee';
  isActive: boolean;
  createdAt: string;
  stationId?: string;
  planId?: string;
  station?: {
    id: string;
    name: string;
  };
  plan?: {
    id: string;
    name: string;
    priceMonthly: number;
  };
  ownedStations?: Array<{
    id: string;
    name: string;
  }>;
}

interface Station {
  id: string;
  name: string;
}

interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  maxStations: number;
  maxEmployees: number;
}

interface Props {
  stations?: Station[];
}

const ROLE_ICONS = {
  super_admin: Crown,
  owner: Building2,
  manager: Briefcase,
  employee: UserIcon
};

import { getRoleBadgeClasses, getStatusBadgeClasses, getPlanBadgeClasses, getStationBadgeClasses } from '@/lib/badgeColors';

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
    password: 'changeme123',
    stationId: '',
    planId: '' // Will be set to basic plan by default
  });
  
  // Edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'employee' as User['role'],
    stationId: '',
    planId: '',
    isActive: true
  });
  
  const { toast } = useToast();


  const { isAuthenticated, loading: authLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchData();
    }
  }, [isAuthenticated, authLoading]);

  // No forced default plan for owners; user must select plan explicitly.

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, stationsRes, plansRes] = await Promise.all([
        apiClient.get<User[]>('/users'),
        apiClient.get<Station[]>('/stations'),
        apiClient.get<Plan[]>('/plans')
      ]);
      
      console.log('👥 Users response:', usersRes);
      console.log('🏢 Stations response:', stationsRes);
      console.log('📋 Plans response:', plansRes);
      
      setUsers(usersRes || []);
      setStations(stationsRes || []);
      setPlans(plansRes || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      let message = 'Failed to fetch data';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error && 'message' in error) {
        message = String((error as { message?: string }).message);
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      email: '',
      phone: '',
      role: 'employee',
      password: 'changeme123',
      stationId: '',
      planId: ''
    });
  };

  const handleCreateUser = async () => {
    if (!createForm.name || !createForm.email) {
      toast({ title: "Validation Error", description: "Name and email are required", variant: "destructive" });
      return;
    }

    // Validate station for manager/employee
    if ((createForm.role === 'manager' || createForm.role === 'employee') && !createForm.stationId) {
      toast({ title: "Validation Error", description: "Manager/Employee must be assigned to a station", variant: "destructive" });
      return;
    }

    // Fallback to 'basic' plan if owner and no plan selected
    let planIdToUse = createForm.planId;
    if (createForm.role === 'owner' && !planIdToUse) {
      const basicPlan = plans.find(p => p.name.toLowerCase() === 'basic');
      if (basicPlan) {
        planIdToUse = basicPlan.id;
      } else {
        toast({ title: "Validation Error", description: "No plan selected and no 'basic' plan found.", variant: "destructive" });
        return;
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

      toast({ title: "Success", description: "User created successfully" });
      setIsCreateOpen(false);
      resetCreateForm();
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to create user';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error && 'message' in error) {
        message = String((error as { message?: string }).message);
      }
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      stationId: user.stationId || user.station?.id || '',
      planId: user.planId || user.plan?.id || '',
      isActive: user.isActive
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

      toast({ title: "Success", description: "User updated successfully" });
      setIsEditOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to update user';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error && 'message' in error) {
        message = String((error as { message?: string }).message);
      }
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await apiClient.delete(`/users/${userId}`);
      toast({ title: "Success", description: "User deleted successfully" });
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to delete user';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error && 'message' in error) {
        message = String((error as { message?: string }).message);
      }
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await apiClient.put(`/users/${user.id}`, { isActive: !user.isActive });
      toast({ title: "Success", description: `User ${user.isActive ? 'deactivated' : 'activated'} successfully` });
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to update status';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error && 'message' in error) {
        message = String((error as { message?: string }).message);
      }
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
              <Badge variant="outline" className={getStatusBadgeClasses(user.isActive)}>
                {user.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
            
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant="outline" className={getRoleBadgeClasses(user.role)}>
                {getRoleIcon(user.role)}
                <span className="ml-1 capitalize">{user.role.replace('_', ' ')}</span>
              </Badge>
              
              {user.role === 'owner' && user.plan && (
                <Badge variant="secondary">
                  Plan: {user.plan.name}
                </Badge>
              )}
              
              {(user.role === 'manager' || user.role === 'employee') && user.station && (
                <Badge variant="secondary">
                  Station: {user.station.name}
                </Badge>
              )}
              
              {user.role === 'owner' && user.ownedStations && user.ownedStations.length > 0 && (
                <Badge variant="outline">
                  {user.ownedStations.length} station(s)
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
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Enter user name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Default: changeme123"
                />
              </div>
              <div>
                <Label htmlFor="role">Role *</Label>
                <Select 
                  value={createForm.role}
                  onValueChange={(value) => setCreateForm({
                    ...createForm,
                    role: value as User['role'],
                    stationId: '',
                    planId: '' // Do not auto-set planId, let user pick
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">
                      <span className="flex items-center gap-2">
                        <Crown className="h-4 w-4" /> Super Admin
                      </span>
                    </SelectItem>
                    <SelectItem value="owner">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> Owner (can create stations)
                      </span>
                    </SelectItem>
                    <SelectItem value="manager">
                      <span className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" /> Manager
                      </span>
                    </SelectItem>
                    <SelectItem value="employee">
                      <span className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4" /> Employee
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Plan selection for owners */}
              {createForm.role === 'owner' && (
                <div>
                  <Label htmlFor="plan">Subscription Plan *</Label>
                  <Select value={createForm.planId} onValueChange={(value) => setCreateForm({ ...createForm, planId: value })}>
                    <SelectTrigger>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Plan determines limits for stations, pumps, employees, etc.
                  </p>
                </div>
              )}

              {/* Station selection for manager/employee */}
              {(createForm.role === 'manager' || createForm.role === 'employee') && (
                <div>
                  <Label htmlFor="station">Assigned Station *</Label>
                  <Select value={createForm.stationId} onValueChange={(value) => setCreateForm({ ...createForm, stationId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent>
                      {stations.map((station) => (
                        <SelectItem key={station.id} value={station.id}>
                          {station.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                          <Badge variant="outline" className={getRoleBadgeClasses(user.role)}>
                            {getRoleIcon(user.role)}
                            <span className="ml-1 capitalize">{user.role.replace('_', ' ')}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.role === 'owner' && (
                            <div>
                              <Badge variant="secondary">
                                {user.plan?.name || 'No plan'}
                              </Badge>
                              {user.ownedStations && user.ownedStations.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {user.ownedStations.length} station(s) owned
                                </div>
                              )}
                            </div>
                          )}
                          {(user.role === 'manager' || user.role === 'employee') && (
                            <Badge variant="outline">
                              {user.station?.name || 'Not assigned'}
                            </Badge>
                          )}
                          {(user.role === 'super_admin') && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusBadgeClasses(user.isActive)}>
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
                    {stations.map((station) => (
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
