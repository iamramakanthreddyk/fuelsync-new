import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiResponse, getToken } from "@/lib/api-client";
import { Plus, Building2, MapPin, Fuel, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface StationWithDetails {
  id: number;
  name: string;
  brand: 'IOCL' | 'BPCL' | 'HPCL';
  address: string;
  owner_id: string; // UUID
  current_plan_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  users: { id: string; name: string; email: string; role: string } | null;
  plans: { id: number; name: string; price_monthly: number } | null;
}

interface User {
  id: string; // UUID
  name: string;
  email: string;
  role: string;
}

interface Plan {
  id: number;
  name: string;
  price_monthly: number;
}

export default function AdminStations() {
  const [isAddStationOpen, setIsAddStationOpen] = useState(false);
  const [newStation, setNewStation] = useState({
    name: '',
    brand: 'IOCL' as const,
    address: '',
    owner_id: '',
    current_plan_id: ''
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Only superadmin can access this page
  if (user?.role !== 'superadmin' && user?.role !== 'super_admin') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. This page is only available to super administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch stations using the REST API
  const { data: stations, isLoading } = useQuery({
    queryKey: ['admin-stations'],
    queryFn: async () => {
      const data = await apiClient.get<StationWithDetails[]>('/admin/stations');
      return data || [];
    },
  });

  // Fetch owners for dropdown
  const { data: owners } = useQuery({
    queryKey: ['owners'],
    queryFn: async () => {
      const data = await apiClient.get<User[]>('/users?role=owner');
      return data || [];
    },
  });

  // Fetch plans for dropdown
  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const data = await apiClient.get<Plan[]>('/plans');
      return data || [];
    },
  });

  // Add station mutation using REST API
  const addStationMutation = useMutation({
    mutationFn: async (stationData: typeof newStation) => {
      return await apiClient.post<StationWithDetails>('/admin/stations', {
        name: stationData.name,
        brand: stationData.brand,
        address: stationData.address,
        owner_id: stationData.owner_id,
        current_plan_id: stationData.current_plan_id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stations'] });
      setIsAddStationOpen(false);
      setNewStation({
        name: '',
        brand: 'IOCL',
        address: '',
        owner_id: '',
        current_plan_id: ''
      });
      toast({
        title: "Success",
        description: "Station created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create station",
        variant: "destructive",
      });
    },
  });

  const handleAddStation = () => {
    if (!newStation.name || !newStation.address || !newStation.owner_id || !newStation.current_plan_id) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    addStationMutation.mutate(newStation);
  };

  const getBrandColor = (brand: string) => {
    switch (brand) {
      case 'IOCL': return 'bg-red-100 text-red-800';
      case 'BPCL': return 'bg-green-100 text-green-800';
      case 'HPCL': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading stations...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Station Management</h1>
          <p className="text-muted-foreground">Manage fuel stations across the system</p>
        </div>
        
        <Dialog open={isAddStationOpen} onOpenChange={setIsAddStationOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Station
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Station</DialogTitle>
              <DialogDescription>
                Create a new fuel station in the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Station Name</Label>
                <Input
                  id="name"
                  value={newStation.name}
                  onChange={(e) => setNewStation(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Green Valley IOCL"
                />
              </div>
              <div>
                <Label htmlFor="brand">Brand</Label>
                <Select value={newStation.brand} onValueChange={(value: any) => setNewStation(prev => ({ ...prev, brand: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IOCL">IOCL</SelectItem>
                    <SelectItem value="BPCL">BPCL</SelectItem>
                    <SelectItem value="HPCL">HPCL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={newStation.address}
                  onChange={(e) => setNewStation(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main Street, City, State, PIN"
                />
              </div>
              <div>
                <Label htmlFor="owner">Station Owner</Label>
                <Select value={newStation.owner_id} onValueChange={(value) => setNewStation(prev => ({ ...prev, owner_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {owners?.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id.toString()}>
                        {owner.name} ({owner.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="plan">Plan</Label>
                <Select value={newStation.current_plan_id} onValueChange={(value) => setNewStation(prev => ({ ...prev, current_plan_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans?.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id.toString()}>
                        {plan.name} (₹{plan.price_monthly}/month)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddStation} disabled={addStationMutation.isPending} className="w-full">
                {addStationMutation.isPending ? 'Creating...' : 'Create Station'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stations?.map((station) => (
          <Card key={station.id} className="relative">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    {station.name}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {station.address}
                  </CardDescription>
                </div>
                <Badge className={getBrandColor(station.brand)}>
                  {station.brand}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm">
                <div className="text-muted-foreground">Owner:</div>
                <div>{station.users?.name || 'Unknown'}</div>
                <div className="text-xs text-muted-foreground">{station.users?.email}</div>
              </div>
              
              <div className="text-sm">
                <div className="text-muted-foreground">Plan:</div>
                <div className="flex items-center gap-2">
                  <span>{station.plans?.name || 'No Plan'}</span>
                  {station.plans?.price_monthly && (
                    <Badge variant="outline">
                      ₹{station.plans.price_monthly}/mo
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Created: {new Date(station.created_at).toLocaleDateString()}
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Fuel className="w-3 h-3 mr-1" />
                  View Pumps
                </Button>
                <Button variant="outline" size="sm">
                  <Users className="w-3 h-3 mr-1" />
                  Employees
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!stations || stations.length === 0) && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No stations found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by creating fuel stations in the system.
            </p>
            <Button onClick={() => setIsAddStationOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Station
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
