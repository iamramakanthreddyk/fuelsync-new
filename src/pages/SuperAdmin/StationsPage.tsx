
import { useState, useEffect } from 'react';
import {
  isValidEmail,
  isValidPhone,
  sanitizeString
} from '@/lib/validation-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { apiClient } from "@/lib/api";
import { handleApiCall } from "@/lib/handleApiCall";
import { getUserMessage, getValidationErrors } from "@/lib/error-utils";
import { Building2, Plus, Search, Edit, Trash2 } from "lucide-react";

// Station interface matching backend model
interface Station {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  ownerId: string;
  isActive: boolean;
  createdAt: string;
  pumpCount?: number;
  activePumps?: number;
  owner?: {
    id: string;
    name: string;
    email: string;
    plan?: {
      name: string;
      priceMonthly: number;
    };
  };
}

interface Owner {
  id: string;
  name: string;
  email: string;
  role: string;
  plan?: {
    id: string;
    name: string;
    priceMonthly: number;
    maxStations: number;
  };
}

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    gstNumber: '',
    ownerId: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [stationsRes, stationsErr] = await handleApiCall(() => apiClient.get<Station[]>("/stations"));
    const [usersRes, usersErr] = await handleApiCall(() => apiClient.get<Owner[]>("/users"));
    if (stationsErr || usersErr) {
      toast({
        title: "Error",
        description: getUserMessage(stationsErr || usersErr),
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    setStations(stationsRes || []);
    setOwners((usersRes || []).filter((user: Owner) => user.role === 'owner'));
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      phone: '',
      email: '',
      gstNumber: '',
      ownerId: ''
    });
    setFormErrors({});
  };

  // Auto-generate station code when owner is selected
  const generateStationCode = (ownerId: string) => {
    const owner = owners.find(o => o.id === ownerId);
    if (!owner) return '';
    
    // Get owner's existing stations count
    const ownerStationsCount = stations.filter(s => s.ownerId === ownerId).length;
    
    // Generate code: First 3 letters of name + count + 1
    const namePrefix = owner.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const code = `${namePrefix}${String(ownerStationsCount + 1).padStart(3, '0')}`;
    
    return code;
  };

  // Shared validation and sanitization for create/edit
  const validateAndSanitize = (data: typeof formData, isEdit = false) => {
    const errors: Record<string, string> = {};
    // Required fields
    if (!data.name?.trim()) errors.name = "Station name is required";
    if (!isEdit && !data.ownerId?.trim()) errors.ownerId = "Please select an owner";
    if (!data.phone?.trim()) errors.phone = "Phone number is required";
    else if (!isValidPhone(data.phone)) errors.phone = "Invalid phone number format";
    if (data.email && !isValidEmail(data.email)) errors.email = "Invalid email address";
    // Sanitize all string fields
    const sanitized = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? sanitizeString(v) : v])
    );
    return { errors, sanitized };
  };

  const handleCreateStation = async () => {
    const { errors, sanitized } = validateAndSanitize(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    const payload: any = {
      name: sanitized.name,
      ownerId: sanitized.ownerId,
      phone: sanitized.phone
    };
    if (sanitized.address) payload.address = sanitized.address;
    if (sanitized.city) payload.city = sanitized.city;
    if (sanitized.state) payload.state = sanitized.state;
    if (sanitized.pincode) payload.pincode = sanitized.pincode;
    if (sanitized.email) payload.email = sanitized.email;
    if (sanitized.gstNumber) payload.gstNumber = sanitized.gstNumber;
    if (sanitized.code) payload.code = sanitized.code;
    const [, error] = await handleApiCall(() => apiClient.post('/stations', payload));
    if (error) {
      setFormErrors(getValidationErrors(error));
      toast({
        title: "Error",
        description: getUserMessage(error),
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Station Created",
      description: "Station has been created successfully",
    });
    setIsCreateOpen(false);
    resetForm();
    fetchData();
  };

  const handleEditStation = async () => {
    if (!selectedStation) return;
    const { errors, sanitized } = validateAndSanitize(formData, true);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast({
        title: "Validation Error",
        description: Object.values(errors).join(', '),
        variant: "destructive",
      });
      return;
    }
    setFormErrors({});
    const payload: any = { name: sanitized.name };
    if (sanitized.code) payload.code = sanitized.code;
    if (sanitized.address) payload.address = sanitized.address;
    if (sanitized.city) payload.city = sanitized.city;
    if (sanitized.state) payload.state = sanitized.state;
    if (sanitized.pincode) payload.pincode = sanitized.pincode;
    if (sanitized.phone) payload.phone = sanitized.phone;
    if (sanitized.email) payload.email = sanitized.email;
    if (sanitized.gstNumber) payload.gstNumber = sanitized.gstNumber;
    const [, error] = await handleApiCall(() => apiClient.put(`/stations/${selectedStation.id}`, payload));
    if (error) {
      setFormErrors(getValidationErrors(error));
      toast({
        title: "Error",
        description: getUserMessage(error),
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Station Updated",
      description: "Station has been updated successfully",
    });
    setIsEditOpen(false);
    setSelectedStation(null);
    resetForm();
    fetchData();
  };

  const handleDeleteStation = async (stationId: string) => {
    const [, error] = await handleApiCall(() => apiClient.delete(`/stations/${stationId}`));
    if (error) {
      toast({
        title: "Error",
        description: getUserMessage(error),
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Station Deleted",
      description: "Station has been deleted successfully",
    });
    fetchData();
  };

  const openEditDialog = (station: Station) => {
    setSelectedStation(station);
    setFormData({
      name: station.name,
      code: station.code || '',
      address: station.address || '',
      city: station.city || '',
      state: station.state || '',
      pincode: station.pincode || '',
      phone: station.phone || '',
      email: station.email || '',
      gstNumber: station.gstNumber || '',
      ownerId: station.ownerId
    });
    setIsEditOpen(true);
  };

  const filteredStations = stations.filter(station => 
    station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    station.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    station.owner?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stations Management</h1>
          <p className="text-muted-foreground">Manage all fuel stations. Note: Plans are assigned to Owners, not stations.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Station
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Station</DialogTitle>
              <DialogDescription>
                Add a new fuel station. The station's plan limits are inherited from the owner's subscription.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="name">Station Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  placeholder="Enter station name"
                  className={formErrors.name ? 'border-red-500' : ''}
                />
                {formErrors.name && <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>}
              </div>
              
              <div>
                <Label htmlFor="owner">Owner *</Label>
                <Select 
                  value={formData.ownerId} 
                  onValueChange={(value) => {
                    console.log('🎯 Owner selected:', value);
                    setFormData({ ...formData, ownerId: value });
                    if (formErrors.ownerId) setFormErrors({ ...formErrors, ownerId: '' });
                  }}
                >
                  <SelectTrigger className={formErrors.ownerId ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.length === 0 && (
                      <div className="p-2 text-sm text-muted-foreground">No owners found</div>
                    )}
                    {owners.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        <div className="flex flex-col">
                          <span>{owner.name} ({owner.email})</span>
                          {owner.plan && (
                            <span className="text-xs text-muted-foreground">
                              Plan: {owner.plan.name} (max {owner.plan.maxStations} stations)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.ownerId && <p className="text-sm text-red-500 mt-1">{formErrors.ownerId}</p>}
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter station address"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="State"
                  />
                </div>
                <div>
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="Pincode"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' });
                    }}
                    placeholder="Phone number"
                    className={formErrors.phone ? 'border-red-500' : ''}
                  />
                  {formErrors.phone && <p className="text-sm text-red-500 mt-1">{formErrors.phone}</p>}
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Station email"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="gstNumber">GST Number</Label>
                <Input
                  id="gstNumber"
                  value={formData.gstNumber}
                  onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                  placeholder="GST Number"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleCreateStation}>Create Station</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Stations
          </CardTitle>
          <CardDescription>
            Total stations: {stations.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name, city, or owner..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading stations...</div>
          ) : filteredStations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No stations found. Create an owner first, then create stations.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name / Code</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Owner's Plan</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Pumps</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStations.map((station) => (
                  <TableRow key={station.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{station.name}</div>
                        {station.code && (
                          <div className="text-xs text-muted-foreground">{station.code}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{station.owner?.name || 'No owner'}</div>
                        <div className="text-sm text-muted-foreground">{station.owner?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {station.owner?.plan ? (
                        <Badge variant="outline">{station.owner.plan.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">No plan</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {station.city && station.state 
                          ? `${station.city}, ${station.state}`
                          : station.address || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {station.activePumps !== undefined 
                          ? `${station.activePumps}/${station.pumpCount || 0} active`
                          : '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={station.isActive ? 'default' : 'destructive'}>
                        {station.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(station)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Station</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{station.name}"? This will also remove all associated pumps, nozzles, and readings.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteStation(station.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Station</DialogTitle>
            <DialogDescription>
              Update station information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name">Station Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter station name"
                />
              </div>
              <div>
                <Label htmlFor="edit-code">Station Code</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., STN001"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter station address"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-city">City</Label>
                <Input
                  id="edit-city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="edit-state">State</Label>
                <Input
                  id="edit-state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="State"
                />
              </div>
              <div>
                <Label htmlFor="edit-pincode">Pincode</Label>
                <Input
                  id="edit-pincode"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  placeholder="Pincode"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Station email"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-gstNumber">GST Number</Label>
              <Input
                id="edit-gstNumber"
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                placeholder="GST Number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleEditStation}>Update Station</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
