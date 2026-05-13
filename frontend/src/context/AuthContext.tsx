import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, getStoredUser, getStoredToken, login as authLogin, logout as authLogout, verifyToken } from '../services/authService.ts';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = getStoredUser();
    const token = getStoredToken();
    let mounted = true;
    const init = async () => {
      if (storedUser && token) {
        const ok = await verifyToken(token);
        if (ok) {
          if (mounted) setUser(storedUser);
        } else {
          // invalid token; ensure local storage is cleared
          authLogout();
        }
      }
      if (mounted) setIsLoading(false);
    };
    init();
    return () => { mounted = false; };
  }, []);

  const login = async (identifier: string, password: string) => {
    const response = await authLogin(identifier, password);
    setUser(response.user);
    // runtime data is loaded by DataProvider
  };

  const logout = () => {
    authLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
