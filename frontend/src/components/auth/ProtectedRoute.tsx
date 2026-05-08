import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { UserRole } from '../../services/authService.ts';
import { GraduationCap, ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  fallbackToPublic?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles,
  fallbackToPublic = false
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // If public fallback is allowed (like Student View)
  if (!isAuthenticated && fallbackToPublic) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
           <GraduationCap className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Restricted Access</h2>
        <p className="text-slate-500 max-w-sm font-medium mb-8">Please authenticate with your university credentials to access this administrative portal.</p>
        <button 
          onClick={() => window.location.href = '#login'} 
          className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all"
        >
          Return to Portal
        </button>
      </div>
    );
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50 text-center">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6">
           <ShieldAlert className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Permission Denied</h2>
        <p className="text-slate-500 max-w-sm font-medium">Your current role tier ({user.role}) does not have execution privileges for this core module.</p>
      </div>
    );
  }

  return <>{children}</>;
};
