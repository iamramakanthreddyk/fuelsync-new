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
import type { Station, User, Plan } from '@/types/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Using canonical types from '@/types/api'

type NewStation = {
  name: string;
  brand: 'IOCL' | 'BPCL' | 'HPCL';
  address: string;
  owner_id: string;
  current_plan_id: string;
}


export default function AdminStations() {
  const [isAddStationOpen, setIsAddStationOpen] = useState(false);
  const [newStation, setNewStation] = useState<NewStation>({
    name: '',
    brand: 'IOCL',
    address: '',
    owner_id: '',
    current_plan_id: ''
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch stations using the REST API
  const { data: stations, isLoading } = useQuery({
    queryKey: ['admin-stations'],
    queryFn: async () => {
      const response = await apiClient.get<any>('/admin/stations');
      
      // Extract data from wrapped response { success, data, pagination }
      if (response && typeof response === 'object') {
        if ('data' in response && Array.isArray(response.data)) {
          return response.data;
        }
        if (Array.isArray(response)) {
          return response;
        }
      }
      return [];
    },
  });

  // Fetch owners for dropdown
  const { data: owners, isLoading: ownersLoading, error: ownersError } = useQuery({
    queryKey: ['owners'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<any>('/users?role=owner');
        
        // Extract data from wrapped response { success, data, pagination }
        let usersList: User[] = [];
        
        if (response && typeof response === 'object') {
          if ('data' in response && Array.isArray(response.data)) {
            usersList = response.data;
          } else if (Array.isArray(response)) {
            usersList = response;
          }
        }
        
        // Filter for owner role
        const owners = usersList.filter((user: User) => user.role === 'owner');
        return owners;
      } catch (error) {
        console.error('Error fetching owners:', error);
        throw error;
      }
    },
  });

  // Fetch plans for dropdown
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<any>('/plans');
        
        // Extract data from wrapped response
        if (response && typeof response === 'object') {
          if ('data' in response && Array.isArray(response.data)) {
            return response.data;
          }
          if (Array.isArray(response)) {
            return response;
          }
        }
        return [];
      } catch (error) {
        console.error('Error fetching plans:', error);
        throw error;
      }
    },
  });

  // Add station mutation using REST API
  const addStationMutation = useMutation({
    mutationFn: async (stationData: typeof newStation) => {
      return await apiClient.post<Station>('/admin/stations', {
        name: stationData.name,
        brand: stationData.brand,
        address: stationData.address,
        ownerId: stationData.owner_id,
        currentPlanId: stationData.current_plan_id
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
    onError: (error: unknown) => {
      let message = "Failed to create station";
      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
      ) {
        message = (error as { message: string }).message;
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Only superadmin can access this page
  if (user?.role !== 'super_admin') {
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
                <Select value={newStation.brand} onValueChange={(value: NewStation['brand']) => setNewStation(prev => ({ ...prev, brand: value }))}>
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
                  <SelectTrigger disabled={ownersLoading}>
                    <SelectValue placeholder={ownersLoading ? "Loading owners..." : "Select an owner"} />
                  </SelectTrigger>
                  <SelectContent>
                    {ownersLoading && (
                      <div className="p-2 text-sm text-muted-foreground">Loading owners...</div>
                    )}
                    {!ownersLoading && owners && owners.length === 0 && (
                      <div className="p-2 text-sm text-muted-foreground">No owners found</div>
                    )}
                    {!ownersLoading && owners?.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id.toString()}>
                        {owner.name} ({owner.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ownersError && (
                  <p className="text-xs text-red-500 mt-1">Failed to load owners</p>
                )}
              </div>
              <div>
                <Label htmlFor="plan">Plan</Label>
                <Select value={newStation.current_plan_id} onValueChange={(value) => setNewStation(prev => ({ ...prev, current_plan_id: value }))}>
                  <SelectTrigger disabled={plansLoading}>
                    <SelectValue placeholder={plansLoading ? "Loading plans..." : "Select a plan"} />
                  </SelectTrigger>
                  <SelectContent>
                    {plansLoading && (
                      <div className="p-2 text-sm text-muted-foreground">Loading plans...</div>
                    )}
                    {!plansLoading && plans && plans.length === 0 && (
                      <div className="p-2 text-sm text-muted-foreground">No plans found</div>
                    )}
                    {!plansLoading && plans?.map((plan: any) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} (₹{plan.priceMonthly}/month)
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
        {stations?.map((station: any) => (
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
                <Badge className={getBrandColor((station as any).brand || 'IOCL')}>
                  {(station as any).brand || 'IOCL'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm">
                <div className="text-muted-foreground">Owner:</div>
                <div>{(station.owner && station.owner.name) || 'Unknown'}</div>
                <div className="text-xs text-muted-foreground">{(station.owner && station.owner.email) || ''}</div>
              </div>
              
              <div className="text-sm">
                <div className="text-muted-foreground">Plan:</div>
                <div className="flex items-center gap-2">
                  <span>{(station.plan && station.plan.name) || 'No Plan'}</span>
                  {station.plan?.priceMonthly && (
                    <Badge variant="outline">
                      ₹{station.plan.priceMonthly}/mo
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Created: {new Date(station.createdAt).toLocaleDateString()}
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
