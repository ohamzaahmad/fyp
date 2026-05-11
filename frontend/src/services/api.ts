import axios from 'axios';
import { ClassSession, Department, Faculty, NexusMasterMap, Room } from '../types.ts';
import { logout, getStoredToken, refreshToken } from './authService.ts';

// Use Vite-provided env var when available, otherwise fall back to relative '/api'
const API_BASE_URL = ((import.meta as any).env?.VITE_API_URL as string) || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor for JWT
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      if (!config.headers) config.headers = {} as any;
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to attempt refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v?: any) => void; reject: (e?: any) => void; config: any }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(p => {
    if (error) p.reject(error);
    else {
      if (token) p.config.headers = { ...(p.config.headers || {}), Authorization: `Bearer ${token}` };
      p.resolve(api(p.config));
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const newAccess = await refreshToken();
        processQueue(null, newAccess);
        originalRequest.headers = { ...(originalRequest.headers || {}), Authorization: `Bearer ${newAccess}` };
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        logout();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export const getMasterTimetable = async (): Promise<NexusMasterMap> => {
  try {
    const response = await api.get('/timetable/master-map/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch master timetable map:', error);
    throw error;
  }
};

export const moveClass = async (id: string, newTime: string, roomId?: string): Promise<ClassSession> => {
  try {
    const response = await api.patch(`/timetable/${id}/move/`, { 
      startTime: newTime,
      roomId: roomId 
    });
    return response.data;
  } catch (error) {
    console.error('Failed to move class:', error);
    throw error;
  }
};

export const generateSchedule = async (): Promise<{ status: string; task_id: string }> => {
  try {
    const response = await api.post('/timetable/generate/');
    return response.data;
  } catch (error) {
    console.error('Failed to trigger optimization:', error);
    throw error;
  }
};

export const fetchDepartments = async (): Promise<Department[]> => {
  try {
    const response = await api.get('/departments/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch departments:', error);
    throw error;
  }
};

export const fetchFaculty = async (): Promise<Faculty[]> => {
  try {
    const response = await api.get('/faculty/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch faculty:', error);
    throw error;
  }
};

export const fetchRooms = async (): Promise<Room[]> => {
  try {
    const response = await api.get('/rooms/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    throw error;
  }
};

export default api;
