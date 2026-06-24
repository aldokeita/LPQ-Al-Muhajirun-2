
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, profileLoading, role } = useAuth();
  const location = useLocation();
  const roleIsAllowed = !allowedRoles || allowedRoles.includes(role);

  useEffect(() => {
    console.log('ProtectedRoute mounting/updating', { 
      path: location.pathname, 
      isLoading: loading,
      isProfileLoading: profileLoading,
      isAuthenticated: !!user,
      userId: user?.id,
      role,
      allowedRoles,
    });
  }, [user, loading, profileLoading, location, role, allowedRoles]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    console.log('Unauthorized access attempt to', location.pathname, '- Redirecting to /login');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!roleIsAllowed) {
    console.warn('Forbidden route access attempt', {
      path: location.pathname,
      role,
      allowedRoles,
    });

    if (location.pathname !== '/dashboard') {
      return <Navigate to="/dashboard" replace />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-card border border-border rounded-xl p-6">
          <h1 className="text-xl font-bold text-foreground mb-2">Akses Ditolak</h1>
          <p className="text-muted-foreground">
            Akun Anda tidak memiliki izin untuk membuka halaman ini.
          </p>
        </div>
      </div>
    );
  }

  console.log('Access granted to protected route:', location.pathname);
  return children;
};

export default ProtectedRoute;
