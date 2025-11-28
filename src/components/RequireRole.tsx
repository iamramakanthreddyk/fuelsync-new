
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';

type UserRole = 'super_admin' | 'superadmin' | 'owner' | 'manager' | 'employee';

interface RequireRoleProps {
  role: UserRole | UserRole[];
  children: React.ReactNode;
}

// Map old role names to new ones
function normalizeRole(role: string): string {
  if (role === 'superadmin') return 'super_admin';
  return role;
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowedRoles = Array.isArray(role) ? role.map(normalizeRole) : [normalizeRole(role)];
  const userRole = normalizeRole(user.role);

  if (!allowedRoles.includes(userRole)) {
    // Redirect based on actual role
    if (userRole === 'super_admin') {
      return <Navigate to="/superadmin/users" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
