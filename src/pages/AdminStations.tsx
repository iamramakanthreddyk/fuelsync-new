import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Plus, Building2, MapPin, Fuel, Users } from "lucide-react";
import type { Station, User } from '@/types/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Using canonical types from '@/types/api'

type NewStation = {
  name: string;
  address: string;
  owner_id: string;
}


export default function AdminStations() {
  const [isAddStationOpen, setIsAddStationOpen] = useState(false);
  const [newStation, setNewStation] = useState<NewStation>({
    name: '',
    address: '',
    owner_id: ''
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch stations using the REST API
  const { data: stations, isLoading } = useQuery({
    queryKey: ['admin-stations'],
    queryFn: async () => {
      const response = await apiClient.get<any>('/api/v1/stations');
      
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

  // Fetch selected owner's plan and station count for validation
  const { data: selectedOwnerData } = useQuery({
    queryKey: ['owner-data', newStation.owner_id],
    queryFn: async () => {
      if (!newStation.owner_id) return null;
      
      try {
        // Get owner details with plan
        const ownerResponse = await apiClient.get<any>(`/users/${newStation.owner_id}`);
        const owner = ownerResponse?.data || ownerResponse;
        
        // Get owner's current station count
        const stationsResponse = await apiClient.get<any>('/api/v1/stations');
        const allStations = stationsResponse?.data || stationsResponse || [];
        const ownerStations = allStations.filter((s: any) => s.ownerId === newStation.owner_id);
        
        return {
          owner,
          stationCount: ownerStations.length,
          plan: owner?.plan
        };
      } catch (error) {
        console.error('Error fetching owner data:', error);
        throw error;
      }
    },
    enabled: !!newStation.owner_id,
  });

  // Add station mutation using REST API
  const addStationMutation = useMutation({
    mutationFn: async (stationData: typeof newStation) => {
      return await apiClient.post<Station>('/api/v1/stations', {
        name: stationData.name,
        address: stationData.address,
        ownerId: stationData.owner_id,
        currentPlanId: selectedOwnerData?.plan?.id, // Send owner's current plan ID for validation
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stations'] });
      queryClient.invalidateQueries({ queryKey: ['owner-data'] });
      setIsAddStationOpen(false);
      setNewStation({
        name: '',
        address: '',
        owner_id: ''
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
    // Frontend validation matching backend Joi schema
    const errors: string[] = [];
    
    // Name validation
    if (!newStation.name || newStation.name.trim().length < 2) {
      errors.push("Station name must be at least 2 characters");
    } else if (newStation.name.length > 100) {
      errors.push("Station name cannot exceed 100 characters");
    }
    
    // Address validation (optional but if provided, check length)
    if (newStation.address && newStation.address.length > 255) {
      errors.push("Address cannot exceed 255 characters");
    }
    
    // Owner validation (required for super_admin)
    if (!newStation.owner_id) {
      errors.push("Please select a station owner");
    }
    
    // Plan limit validation
    if (selectedOwnerData && selectedOwnerData.plan?.maxStations != null) {
      const currentCount = selectedOwnerData.stationCount || 0;
      if (currentCount + 1 > selectedOwnerData.plan.maxStations) {
        errors.push(`Plan limit exceeded. ${selectedOwnerData.plan.name} plan allows ${selectedOwnerData.plan.maxStations} station(s). Currently has ${currentCount}.`);
      }
    }
    
    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: errors.join(". "),
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
    <div className="container mx-auto p-4 md:p-6 space-y-6 md:space-y-8">
      {/* Header Section */}
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Station Management</h1>
          <p className="text-muted-foreground text-sm md:text-base">Manage fuel stations across the system</p>
        </div>

        <Dialog open={isAddStationOpen} onOpenChange={setIsAddStationOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Station
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md mx-4">
            <DialogHeader>
              <DialogTitle>Add New Station</DialogTitle>
              <DialogDescription>
                Create a new fuel station in the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
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
                {selectedOwnerData && (
                  <div className="mt-2 p-2 bg-muted rounded text-xs">
                    <div className="font-medium">Plan: {selectedOwnerData.plan?.name || 'No Plan'}</div>
                    <div>Current Stations: {selectedOwnerData.stationCount || 0}</div>
                    {selectedOwnerData.plan?.maxStations && (
                      <div>Limit: {selectedOwnerData.stationCount || 0} / {selectedOwnerData.plan.maxStations}</div>
                    )}
                  </div>
                )}
              </div>
              <Button onClick={handleAddStation} disabled={addStationMutation.isPending || !selectedOwnerData} className="w-full">
                {addStationMutation.isPending ? 'Creating...' : !selectedOwnerData ? 'Loading owner data...' : 'Create Station'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {stations?.map((station: any) => (
          <Card key={station.id} className="relative hover:shadow-lg transition-all duration-200 border-0 shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Building2 className="w-5 h-5 flex-shrink-0" />
                    </div>
                    <span className="truncate">{station.name}</span>
                  </CardTitle>
                  <CardDescription className="flex items-start gap-2">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span className="text-xs truncate">{station.address}</span>
                  </CardDescription>
                </div>
                <Badge className={`${getBrandColor((station as any).brand || 'IOCL')} self-start text-xs font-medium`}>
                  {(station as any).brand || 'IOCL'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Owner Info */}
              <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Owner:</div>
                <div className="font-medium truncate text-sm">{(station.owner && station.owner.name) || 'Unknown'}</div>
                {(station.owner && station.owner.email) && (
                  <div className="text-xs text-muted-foreground truncate">{station.owner.email}</div>
                )}
              </div>

              {/* Plan Info */}
              <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Plan:</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{(station.plan && station.plan.name) || 'No Plan'}</span>
                  {station.plan?.priceMonthly && (
                    <Badge variant="outline" className="text-xs">
                      ₹{station.plan.priceMonthly}/mo
                    </Badge>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted-foreground border-t pt-3">
                Created: {new Date(station.createdAt).toLocaleDateString()}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" className="flex-1 hover:bg-primary/5">
                  <Fuel className="w-4 h-4 mr-2" />
                  View Pumps
                </Button>
                <Button variant="outline" size="sm" className="flex-1 hover:bg-primary/5">
                  <Users className="w-4 h-4 mr-2" />
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
