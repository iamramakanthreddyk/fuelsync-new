import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user || user.role !== 'super_admin') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
