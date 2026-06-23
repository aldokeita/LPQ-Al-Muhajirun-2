
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading, role } = useAuth();
  const location = useLocation();

  useEffect(() => {
    console.log('ProtectedRoute mounting/updating', { 
      path: location.pathname, 
      isLoading: loading,
      isAuthenticated: !!user,
      userId: user?.id,
      role: role
    });
  }, [user, loading, location, role]);

  if (loading) {
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

  console.log('Access granted to protected route:', location.pathname);
  return children;
};

export default ProtectedRoute;
