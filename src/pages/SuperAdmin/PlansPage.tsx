import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import type { Plan } from '@/types/database';
import { Settings, Plus, Edit, Trash2, Check, X, Crown, Building2, Users, CreditCard, Calendar, TrendingUp, FileText, DollarSign, Loader2 } from 'lucide-react';

const defaultFormData: Omit<Plan, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  priceMonthly: 0,
  priceYearly: 0,
  maxStations: 1,
  maxPumpsPerStation: 2,
  maxNozzlesPerPump: 4,
  maxEmployees: 2,
  maxCreditors: 10,
  backdatedDays: 3,
  analyticsDays: 7,
  canExport: false,
  canTrackExpenses: false,
  canTrackCredits: true,
  canViewProfitLoss: false,
  sortOrder: 0,
  isActive: true,
};

export default function PlansPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState<Omit<Plan, 'id' | 'createdAt'>>(defaultFormData);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch plans using React Query
  const { data: plans = [], isLoading, error } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Plan[]>>('/plans');
      if (!response.success) {
        throw new Error('Failed to fetch plans');
      }
      return response.data || [];
    },
  });

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: Omit<Plan, 'id' | 'createdAt'>) => {
      const response = await apiClient.post<ApiResponse<Plan>>('/plans', data);
      if (!response.success) {
        throw new Error('Failed to create plan');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      closeDialog();
      toast({
        title: "Success",
        description: "Plan created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create plan",
        variant: "destructive",
      });
    },
  });

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Omit<Plan, 'id' | 'createdAt'> }) => {
      const response = await apiClient.put<ApiResponse<Plan>>(`/plans/${id}`, data);
      if (!response.success) {
        throw new Error('Failed to update plan');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      closeDialog();
      toast({
        title: "Success",
        description: "Plan updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update plan",
        variant: "destructive",
      });
    },
  });

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiClient.delete<ApiResponse<void>>(`/plans/${planId}`);
      if (!response.success) {
        throw new Error('Failed to deactivate plan');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
      toast({
        title: "Success",
        description: "Plan deactivated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate plan",
        variant: "destructive",
      });
    },
  });

  const handleCreateOrUpdate = () => {
    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Plan name is required",
        variant: "destructive",
      });
      return;
    }

    if (formData.priceMonthly < 0) {
      toast({
        title: "Validation Error",
        description: "Price cannot be negative",
        variant: "destructive",
      });
      return;
    }

    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data: formData });
    } else {
      createPlanMutation.mutate(formData);
    }
  };

  const handleDeleteClick = (planId: string) => {
    setPlanToDelete(planId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (planToDelete) {
      deletePlanMutation.mutate(planToDelete);
    }
  };

  const openCreateDialog = () => {
    setEditingPlan(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      maxStations: plan.maxStations,
      maxPumpsPerStation: plan.maxPumpsPerStation,
      maxNozzlesPerPump: plan.maxNozzlesPerPump,
      maxEmployees: plan.maxEmployees,
      maxCreditors: plan.maxCreditors,
      backdatedDays: plan.backdatedDays,
      analyticsDays: plan.analyticsDays,
      canExport: plan.canExport,
      canTrackExpenses: plan.canTrackExpenses,
      canTrackCredits: plan.canTrackCredits,
      canViewProfitLoss: plan.canViewProfitLoss,
      sortOrder: plan.sortOrder,
      isActive: plan.isActive,
      features: plan.features,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
    setFormData(defaultFormData);
  };

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading plans...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p className="font-semibold mb-2">Failed to load plans</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
              <Button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['plans'] })} 
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSubmitting = createPlanMutation.isPending || updatePlanMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Plan Management</h1>
          <p className="text-muted-foreground">Manage subscription plans and features</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? 'Edit Plan' : 'Create New Plan'}
              </DialogTitle>
              <DialogDescription>
                {editingPlan ? 'Update plan details and features' : 'Create a new subscription plan with resource limits and features'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Plan Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Basic, Premium"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => handleInputChange('sortOrder', parseInt(e.target.value) || 0)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Plan description"
                  disabled={isSubmitting}
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priceMonthly">Monthly Price (₹) *</Label>
                  <Input
                    id="priceMonthly"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.priceMonthly}
                    onChange={(e) => handleInputChange('priceMonthly', parseFloat(e.target.value) || 0)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priceYearly">Yearly Price (₹)</Label>
                  <Input
                    id="priceYearly"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.priceYearly || ''}
                    onChange={(e) => handleInputChange('priceYearly', parseFloat(e.target.value) || undefined)}
                    placeholder="Optional"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Resource Limits */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Resource Limits</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxStations">Max Stations *</Label>
                    <Input
                      id="maxStations"
                      type="number"
                      min="1"
                      value={formData.maxStations}
                      onChange={(e) => handleInputChange('maxStations', parseInt(e.target.value) || 1)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxPumpsPerStation">Max Pumps per Station *</Label>
                    <Input
                      id="maxPumpsPerStation"
                      type="number"
                      min="1"
                      value={formData.maxPumpsPerStation}
                      onChange={(e) => handleInputChange('maxPumpsPerStation', parseInt(e.target.value) || 1)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxNozzlesPerPump">Max Nozzles per Pump *</Label>
                    <Input
                      id="maxNozzlesPerPump"
                      type="number"
                      min="1"
                      value={formData.maxNozzlesPerPump}
                      onChange={(e) => handleInputChange('maxNozzlesPerPump', parseInt(e.target.value) || 1)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxEmployees">Max Employees *</Label>
                    <Input
                      id="maxEmployees"
                      type="number"
                      min="1"
                      value={formData.maxEmployees}
                      onChange={(e) => handleInputChange('maxEmployees', parseInt(e.target.value) || 1)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxCreditors">Max Creditors *</Label>
                    <Input
                      id="maxCreditors"
                      type="number"
                      min="0"
                      value={formData.maxCreditors}
                      onChange={(e) => handleInputChange('maxCreditors', parseInt(e.target.value) || 0)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backdatedDays">Backdated Days *</Label>
                    <Input
                      id="backdatedDays"
                      type="number"
                      min="0"
                      value={formData.backdatedDays}
                      onChange={(e) => handleInputChange('backdatedDays', parseInt(e.target.value) || 0)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="analyticsDays">Analytics Days *</Label>
                    <Input
                      id="analyticsDays"
                      type="number"
                      min="1"
                      value={formData.analyticsDays}
                      onChange={(e) => handleInputChange('analyticsDays', parseInt(e.target.value) || 1)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              {/* Feature Flags */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Features</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="canExport">Can Export Reports</Label>
                    <Switch
                      id="canExport"
                      checked={formData.canExport}
                      onCheckedChange={(checked) => handleInputChange('canExport', checked)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="canTrackExpenses">Can Track Expenses</Label>
                    <Switch
                      id="canTrackExpenses"
                      checked={formData.canTrackExpenses}
                      onCheckedChange={(checked) => handleInputChange('canTrackExpenses', checked)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="canTrackCredits">Can Track Credits</Label>
                    <Switch
                      id="canTrackCredits"
                      checked={formData.canTrackCredits}
                      onCheckedChange={(checked) => handleInputChange('canTrackCredits', checked)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="canViewProfitLoss">Can View Profit/Loss</Label>
                    <Switch
                      id="canViewProfitLoss"
                      checked={formData.canViewProfitLoss}
                      onCheckedChange={(checked) => handleInputChange('canViewProfitLoss', checked)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="isActive">Active</Label>
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleCreateOrUpdate} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingPlan ? 'Update Plan' : 'Create Plan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className={`relative ${!plan.isActive ? 'opacity-60' : ''}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {plan.name}
                    {plan.name.toLowerCase() === 'premium' && (
                      <Crown className="w-4 h-4 text-amber-500" />
                    )}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </div>
                <Badge variant={plan.isActive ? "default" : "secondary"}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pricing */}
              <div className="border-b pb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">₹{plan.priceMonthly}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                {plan.priceYearly && (
                  <div className="text-sm text-muted-foreground mt-1">
                    ₹{plan.priceYearly}/year (Save {Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)}%)
                  </div>
                )}
              </div>

              {/* Limits */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span>{plan.maxStations} Station{plan.maxStations > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <span>{plan.maxPumpsPerStation} Pumps, {plan.maxNozzlesPerPump} Nozzles</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{plan.maxEmployees} Employees</span>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span>{plan.maxCreditors} Creditors</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{plan.backdatedDays} Backdated Days</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <span>{plan.analyticsDays} Analytics Days</span>
                </div>
              </div>

              {/* Features */}
              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {plan.canExport ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}
                  <span>Export Reports</span>
                </div>
                <div className="flex items-center gap-2">
                  {plan.canTrackExpenses ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}
                  <span>Track Expenses</span>
                </div>
                <div className="flex items-center gap-2">
                  {plan.canTrackCredits ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}
                  <span>Track Credits</span>
                </div>
                <div className="flex items-center gap-2">
                  {plan.canViewProfitLoss ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}
                  <span>Profit/Loss View</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(plan)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteClick(plan.id)}
                  className="flex-1"
                  disabled={!plan.isActive || deletePlanMutation.isPending}
                >
                  {deletePlanMutation.isPending && planToDelete === plan.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Deactivate
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {plans.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Plans Found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by creating your first subscription plan
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Create Plan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the plan. Users currently on this plan won't be affected, but new users won't be able to select it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePlanMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              disabled={deletePlanMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePlanMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}