import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { LogOut, User, Building2, Shield, Lock } from "lucide-react";
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Settings() {
  const { user, logout, changePassword } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const currentStation = user?.stations?.[0];
  const { updateProfile } = useAuth();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // Password change state
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const startEdit = () => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    try {
      await updateProfile({ name, phone });
      setEditing(false);
      toast({ title: 'Profile updated', description: 'Your profile has been saved.' });
    } catch (err) {
      console.error('Profile update failed', err);
      toast({ title: 'Update failed', description: 'Unable to update profile', variant: 'destructive' });
    }
  };

  const startPasswordChange = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setChangingPassword(true);
  };

  const cancelPasswordChange = () => {
    setChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const savePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'New passwords do not match', variant: 'destructive' });
      return;
    }

    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'New password must be at least 6 characters long', variant: 'destructive' });
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      setChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password changed', description: 'Your password has been successfully updated.' });
    } catch (err) {
      console.error('Password change failed', err);
      toast({ title: 'Password change failed', description: 'Unable to change password. Please check your current password.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and application preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Information
            </CardTitle>
            <CardDescription>
              Your account details and role
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Name:</span>
              {!editing ? (
                <span className="text-sm">{user?.name || 'Not set'}</span>
              ) : (
                <Input value={name} onChange={e => setName(e.target.value)} className="w-56" />
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Email:</span>
              <span className="text-sm">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Phone:</span>
              {!editing ? (
                <span className="text-sm">{user?.phone || 'Not set'}</span>
              ) : (
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="w-56" />
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Role:</span>
              <span className="text-sm capitalize flex items-center gap-2">
                <Shield className="h-3 w-3" />
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              {!editing ? (
                <Button onClick={startEdit} size="sm">Edit</Button>
              ) : (
                <>
                  <Button onClick={saveEdit} size="sm">Save</Button>
                  <Button variant="ghost" onClick={cancelEdit} size="sm">Cancel</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Station Information
            </CardTitle>
            <CardDescription>
              Current station assignment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentStation ? (
              <>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Station:</span>
                  <span className="text-sm">{currentStation.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Brand:</span>
                  <span className="text-sm">{currentStation.oilCompany || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Address:</span>
                  <span className="text-sm text-right max-w-[200px]">{currentStation.address || 'Not set'}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No station assigned
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password for security
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!changingPassword ? (
            <Button onClick={startPasswordChange} className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Change Password
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={savePasswordChange}>Save Password</Button>
                <Button variant="ghost" onClick={cancelPasswordChange}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Actions</CardTitle>
          <CardDescription>
            Manage your session and account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleLogout}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
