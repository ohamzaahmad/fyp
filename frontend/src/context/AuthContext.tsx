import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, getStoredUser, getStoredToken, login as authLogin, logout as authLogout, verifyToken } from '../services/authService.ts';
import * as api from '../services/api.ts';
import { setRuntimeData } from '../constants.ts';

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
          // fetch runtime reference data after validating token
          try {
            const [departments, faculty, rooms] = await Promise.all([
              api.fetchDepartments(),
              api.fetchFaculty(),
              api.fetchRooms(),
            ]);

            const buildingsMap: Record<string, any> = {};
            rooms.forEach((r: any) => {
              const bId = r.buildingId || r.building_id || 'unknown';
              const fId = r.floorId || r.floor_id || r.floor || 'f1';
              if (!buildingsMap[bId]) buildingsMap[bId] = { id: bId, name: r.buildingName || bId, floors: {} };
              if (!buildingsMap[bId].floors[fId]) buildingsMap[bId].floors[fId] = { id: fId, number: r.floorNumber || 1, rooms: [] };
              buildingsMap[bId].floors[fId].rooms.push({ id: r.id, buildingId: bId, floorId: fId, name: r.name || r.roomName || r.id, capacity: r.capacity || 0 });
            });
            const BUILDINGS = Object.values(buildingsMap).map((b: any) => ({ id: b.id, name: b.name, floors: Object.values(b.floors) }));
            setRuntimeData({ DEPARTMENTS: departments, FACULTY: faculty, BUILDINGS });
          } catch (e) {
            // ignore - will continue using demo constants
            console.warn('Could not load runtime reference data after token verify', e);
          }
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
    // After login, fetch reference data and populate runtime constants
    try {
      const [departments, faculty, rooms] = await Promise.all([
        api.fetchDepartments(),
        api.fetchFaculty(),
        api.fetchRooms(),
      ]);

      const buildingsMap: Record<string, any> = {};
      rooms.forEach((r: any) => {
        const bId = r.buildingId || r.building_id || 'unknown';
        const fId = r.floorId || r.floor_id || r.floor || 'f1';
        if (!buildingsMap[bId]) buildingsMap[bId] = { id: bId, name: r.buildingName || bId, floors: {} };
        if (!buildingsMap[bId].floors[fId]) buildingsMap[bId].floors[fId] = { id: fId, number: r.floorNumber || 1, rooms: [] };
        buildingsMap[bId].floors[fId].rooms.push({ id: r.id, buildingId: bId, floorId: fId, name: r.name || r.roomName || r.id, capacity: r.capacity || 0 });
      });
      const BUILDINGS = Object.values(buildingsMap).map((b: any) => ({ id: b.id, name: b.name, floors: Object.values(b.floors) }));
      setRuntimeData({ DEPARTMENTS: departments, FACULTY: faculty, BUILDINGS });
    } catch (e) {
      console.warn('Could not load runtime reference data after login', e);
    }
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
