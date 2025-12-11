import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export default function AddCreditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    creditLimit: "",
    vehicleNumber: "",
  });

  const createCreditorMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const response = await apiClient.post(`/stations/${id}/creditors`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["station-creditors", id] });
      toast({ title: "Success", description: "Creditor created successfully", variant: "success" });
      navigate(`/owner/stations/${id}?tab=creditors`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create creditor", variant: "destructive" });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCreditorMutation.mutate(form);
  };

  return (
    <div className="container mx-auto max-w-lg py-8">
      <Card>
        <CardHeader>
          <CardTitle>Add New Creditor</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input name="name" id="name" value={form.name} onChange={handleChange} required />
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input name="phone" id="phone" value={form.phone} onChange={handleChange} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input name="email" id="email" value={form.email} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="creditLimit">Credit Limit *</Label>
              <Input
                name="creditLimit"
                id="creditLimit"
                type="number"
                value={form.creditLimit}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="vehicleNumber">Vehicle Number</Label>
              <Input name="vehicleNumber" id="vehicleNumber" value={form.vehicleNumber} onChange={handleChange} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCreditorMutation.isPending}>
                {createCreditorMutation.isPending ? "Saving..." : "Add Creditor"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}