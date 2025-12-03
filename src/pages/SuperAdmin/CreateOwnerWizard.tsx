import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { getErrorMessage } from '@/lib/errorUtils';
import { User, Building2, CheckCircle, AlertCircle } from 'lucide-react';

interface OwnerFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  stationName: string;
  brand: string;
  address: string;
}

export default function CreateOwnerWizard() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<OwnerFormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    stationName: '',
    brand: '',
    address: '',
  });
  const [createdData, setCreatedData] = useState<{ owner: unknown; station: unknown } | null>(null);
  const { toast } = useToast();

  const createOwnerMutation = useMutation({
    mutationFn: async (data: OwnerFormData) => {
      console.log('Creating owner with data:', data);
      // Step 1: Create owner - apiClient unwraps the response automatically
      const ownerResponse = await apiClient.post<{ id: string; planId?: string }>('/users', {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: 'owner'
      });
      console.log('Owner created, response:', ownerResponse);
      const owner = ownerResponse;
      if (!owner || !owner.id) {
        throw new Error('Failed to create owner - invalid response');
      }
      // Verify owner has a plan
      if (!owner.planId) {
        console.warn('Owner created without a plan. This might cause issues.');
      }
      // Step 2: Create station for the owner
      // Note: Brand field is collected but not sent to backend (not in Station model)
      const stationResponse = await apiClient.post<{ id: string }>('/stations', {
        name: data.stationName,
        address: data.address,
        ownerId: owner.id
      });
      console.log('Station created, response:', stationResponse);
      return { owner, station: stationResponse };
    },
    onSuccess: (data) => {
      console.log('Owner created successfully:', data);
      setCreatedData(data);
      setStep(3);
      toast({ 
        title: "Success", 
        description: "Owner and station created successfully!" 
      });
    },
    onError: (error: unknown) => {
      console.error('Create owner error:', getErrorMessage(error));
      const message = getErrorMessage(error) || 'Failed to create owner and station';
      toast({ 
        title: "Error", 
        description: message, 
        variant: "destructive" 
      });
    },
  });

  const updateFormData = (field: keyof OwnerFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step === 1) {
      // Validate owner data
      if (!formData.name || !formData.email || !formData.password) {
        toast({ 
          title: "Validation Error", 
          description: "Please fill in all required fields", 
          variant: "destructive" 
        });
        return;
      }
    }
    setStep(step + 1);
  };

  const handleSubmit = () => {
    // Validate station data
    if (!formData.stationName || !formData.brand || !formData.address) {
      toast({ 
        title: "Validation Error", 
        description: "Please fill in all station fields", 
        variant: "destructive" 
      });
      return;
    }
    createOwnerMutation.mutate(formData);
  };

  const resetForm = () => {
    setStep(1);
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      stationName: '',
      brand: '',
      address: '',
    });
    setCreatedData(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Owner</h1>
        <p className="text-muted-foreground">Set up a new station owner and their first station</p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        <div className={`flex items-center ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-primary bg-primary text-white' : 'border-muted-foreground'}`}>
            1
          </div>
          <span className="ml-2">Owner Info</span>
        </div>
        <div className={`w-8 h-1 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        <div className={`flex items-center ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-primary bg-primary text-white' : 'border-muted-foreground'}`}>
            2
          </div>
          <span className="ml-2">Station Info</span>
        </div>
        <div className={`w-8 h-1 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
        <div className={`flex items-center ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 3 ? 'border-primary bg-primary text-white' : 'border-muted-foreground'}`}>
            ✓
          </div>
          <span className="ml-2">Complete</span>
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Owner Information
            </CardTitle>
            <CardDescription>Enter the details for the new station owner</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  placeholder="Enter email address"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => updateFormData('phone', e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => updateFormData('password', e.target.value)}
                  placeholder="Enter password"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleNext}>Next</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Station Information
            </CardTitle>
            <CardDescription>Enter the details for the owner's first station</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="stationName">Station Name *</Label>
              <Input
                id="stationName"
                value={formData.stationName}
                onChange={(e) => updateFormData('stationName', e.target.value)}
                placeholder="Enter station name"
              />
            </div>
            <div>
              <Label htmlFor="brand">Brand *</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => updateFormData('brand', e.target.value)}
                placeholder="Enter brand (e.g., Shell, BP, Exxon)"
              />
            </div>
            <div>
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => updateFormData('address', e.target.value)}
                placeholder="Enter full station address"
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button 
                onClick={handleSubmit}
                disabled={createOwnerMutation.isPending}
              >
                {createOwnerMutation.isPending ? 'Creating...' : 'Create Owner & Station'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && createdData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Owner Created Successfully!
            </CardTitle>
            <CardDescription>The owner and station have been created</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Owner Name</Label>
                <p className="font-medium">{createdData.owner?.name}</p>
              </div>
              <div>
                <Label>Email</Label>
                <p className="font-medium">{createdData.owner?.email}</p>
              </div>
              <div>
                <Label>Station Name</Label>
                <p className="font-medium">{createdData.station?.name}</p>
              </div>
              <div>
                <Label>Brand</Label>
                <p className="font-medium">{createdData.station?.brand}</p>
              </div>
            </div>
            <div>
              <Label>Station Address</Label>
              <p className="font-medium">{createdData.station?.address}</p>
            </div>
            <div className="flex justify-center">
              <Button onClick={resetForm}>Create Another Owner</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {createOwnerMutation.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <p>Error: {getErrorMessage(createOwnerMutation.error)}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
