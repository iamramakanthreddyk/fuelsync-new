import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiResponse } from "@/lib/api-client";
import { Plus, Building2, MapPin, Fuel, Users, Phone, Mail, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Station {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  gstNumber: string;
  isActive: boolean;
  createdAt: string;
  pumps?: { id: string; name: string; status: string }[];
}

export default function MyStations() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    gstNumber: ''
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Owners only
  if (user?.role !== 'owner') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              This page is only available to station owners.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch owner's stations
  const { data: stations, isLoading, error } = useQuery({
    queryKey: ['my-stations'],
    queryFn: async () => {
      const response = await apiClient.get<Station[]>('/stations');
      return response;
    },
  });

  // Create station mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiClient.post<Station>('/stations', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-stations'] });
      setIsAddDialogOpen(false);
      setFormData({
        name: '', code: '', address: '', city: '', state: '',
        pincode: '', phone: '', email: '', gstNumber: ''
      });
      toast({ title: "Success", description: "Station created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create station",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.city || !formData.state) {
      toast({
        title: "Missing Information",
        description: "Please fill in required fields (Name, City, State)",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading your stations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">Failed to load stations. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">My Stations</h1>
          <p className="text-muted-foreground">Manage your fuel stations</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Station
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Station</DialogTitle>
              <DialogDescription>
                Create a new fuel station. Fill in the details below.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Station Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Fuel Station"
                />
              </div>
              <div>
                <Label htmlFor="code">Station Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="MFS001"
                />
              </div>
              <div>
                <Label htmlFor="gstNumber">GST Number</Label>
                <Input
                  id="gstNumber"
                  value={formData.gstNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, gstNumber: e.target.value }))}
                  placeholder="27AAAAA0000A1Z5"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main Road"
                />
              </div>
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Mumbai"
                />
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="Maharashtra"
                />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value }))}
                  placeholder="400001"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 9876543210"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="station@example.com"
                />
              </div>
              <div className="sm:col-span-2">
                <Button 
                  onClick={handleSubmit} 
                  disabled={createMutation.isPending} 
                  className="w-full"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Station'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {stations?.map((station) => (
          <Card key={station.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="w-5 h-5 text-primary" />
                    {station.name}
                  </CardTitle>
                  {station.code && (
                    <Badge variant="outline" className="mt-1">{station.code}</Badge>
                  )}
                </div>
                <Badge variant={station.isActive ? "default" : "secondary"}>
                  {station.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {station.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground">
                    {station.address}
                    {station.city && `, ${station.city}`}
                    {station.state && `, ${station.state}`}
                    {station.pincode && ` - ${station.pincode}`}
                  </span>
                </div>
              )}
              
              {station.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{station.phone}</span>
                </div>
              )}
              
              {station.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{station.email}</span>
                </div>
              )}

              {station.pumps && station.pumps.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Fuel className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {station.pumps.length} pump{station.pumps.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <a href={`/pumps?stationId=${station.id}`}>
                    <Fuel className="w-3 h-3 mr-1" />
                    Pumps
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <a href={`/staff?stationId=${station.id}`}>
                    <Users className="w-3 h-3 mr-1" />
                    Staff
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {(!stations || stations.length === 0) && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No stations yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first fuel station to start tracking sales and managing your business.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Station
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
