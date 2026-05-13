import axios from 'axios';

// Respect Vite env var (full backend URL) or fall back to relative '/api' which will use the dev server proxy.
const API_BASE_URL = ((import.meta as any).env?.VITE_API_URL as string) || '/api';

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

/**
 * Perform login against backend JWT endpoint and fetch current user.
 * Stores `nexus_token` (access) and `nexus_refresh` in localStorage.
 */
export const login = async (identifier: string, password: string): Promise<AuthResponse> => {
  // Use username + password only (no email fallback)
  const tokenRes = await axios.post(`${API_BASE_URL}/auth/token/`, {
    username: identifier,
    password,
  });

  const { access, refresh } = tokenRes.data;
  localStorage.setItem('nexus_token', access);
  localStorage.setItem('nexus_refresh', refresh);

  // Fetch current user profile from backend and map to frontend shape
  const userRes = await axios.get(`${API_BASE_URL}/auth/me/`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const resp = userRes.data as any;

  const isTeacher = !!(resp?.teacher || resp?.faculty);
  const role: UserRole = resp?.is_superuser || resp?.is_staff ? 'ADMIN' : isTeacher ? 'TEACHER' : 'STUDENT';
  const name = resp?.teacher?.name || resp?.faculty?.name || resp?.username || resp?.email || '';
  const user: AuthUser = {
    id: resp?.username || resp?.email || '',
    name,
    email: resp?.email || '',
    role,
  };

  localStorage.setItem('nexus_user', JSON.stringify(user));
  return { access, refresh, user };
};

export const refreshToken = async (): Promise<string> => {
  const refresh = localStorage.getItem('nexus_refresh');
  if (!refresh) throw new Error('No refresh token available');
  const res = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, { refresh });
  const { access } = res.data;
  localStorage.setItem('nexus_token', access);
  return access;
};

export const verifyToken = async (token: string): Promise<boolean> => {
  try {
    await axios.post(`${API_BASE_URL}/auth/token/verify/`, { token });
    return true;
  } catch (err) {
    return false;
  }
};

export const logout = (): void => {
  localStorage.removeItem('nexus_token');
  localStorage.removeItem('nexus_refresh');
  localStorage.removeItem('nexus_user');
  window.location.href = '/#login';
};

export const getStoredToken = () => localStorage.getItem('nexus_token');
export const getStoredRefreshToken = () => localStorage.getItem('nexus_refresh');
export const getStoredUser = (): AuthUser | null => {
  const user = localStorage.getItem('nexus_user');
  return user ? JSON.parse(user) : null;
};

