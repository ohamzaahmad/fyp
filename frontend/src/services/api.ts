import axios from 'axios';
import { ClassSession, Department, Teacher, MasterMap, Room } from '../types.ts';
import { logout, getStoredToken, refreshToken } from './authService.ts';

// Allow runtime override via localStorage (key: 'nexus_api_base'), otherwise use Vite env or '/api'
const RUNTIME_API_OVERRIDE = (typeof window !== 'undefined' && localStorage.getItem('nexus_api_base')) || null;
const API_BASE_URL = RUNTIME_API_OVERRIDE || ((import.meta as any).env?.VITE_API_URL as string) || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Public API instance (no auth/refresh interceptors) for endpoints that should be accessible without login
export const publicApi = axios.create({
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

export const getMasterTimetable = async (): Promise<MasterMap> => {
  try {
    const response = await publicApi.get('/timetable/master-map/');
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

export const generateSchedule = async (options?: any): Promise<{ status: string; task_id: string }> => {
  try {
    const payload = options || {};
    const response = await api.post('/timetable/generate/', payload);
    return response.data;
  } catch (error) {
    console.error('Failed to trigger optimization:', error);
    throw error;
  }
};

export const fetchDepartments = async (): Promise<Department[]> => {
  try {
    const response = await publicApi.get('/departments/');
    const data = response.data;
    // Keep backwards-compatible contract: return array of names when possible
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      return data.map((d: any) => d.name || d.label || d.code || String(d));
    }
    return data;
  } catch (error) {
    console.error('Failed to fetch departments:', error);
    throw error;
  }
};

export const fetchDepartmentsRaw = async (): Promise<any[]> => {
  try {
    const response = await publicApi.get('/departments/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch departments (raw):', error);
    throw error;
  }
};

export const createDepartment = async (payload: { code: string; name: string }): Promise<any> => {
  try {
    const response = await api.post('/departments/', payload);
    return response.data;
  } catch (error) {
    console.error('Failed to create department:', error);
    throw error;
  }
};

export const updateDepartment = async (id: number, payload: { code?: string; name?: string }): Promise<any> => {
  try {
    const response = await api.put(`/departments/${id}/`, payload);
    return response.data;
  } catch (error) {
    console.error('Failed to update department:', error);
    throw error;
  }
};

export const deleteDepartment = async (id: number): Promise<any> => {
  try {
    const response = await api.delete(`/departments/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete department:', error);
    throw error;
  }
};

// Legacy single-teacher helper removed in favor of `fetchTeachers` (plural)

export const fetchRooms = async (): Promise<Room[]> => {
  try {
    const response = await api.get('/rooms/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    throw error;
  }
};

export const fetchEntries = async (): Promise<any[]> => {
  try {
    const response = await api.get('/entries/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch entries:', error);
    throw error;
  }
};

export const getAnalyticsSummary = async (): Promise<any> => {
  try {
    const response = await api.get('/analytics/summary/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch analytics summary:', error);
    throw error;
  }
};

export const getAnalyticsLogs = async (): Promise<any> => {
  try {
    const response = await api.get('/analytics/logs/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch analytics logs:', error);
    throw error;
  }
};

export const getAnalyticsLoadDistribution = async (): Promise<any> => {
  try {
    const response = await api.get('/analytics/load-distribution/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch analytics load distribution:', error);
    throw error;
  }
};

export const getAnalyticsFeed = async (): Promise<any> => {
  try {
    const response = await api.get('/analytics/feed/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch analytics feed:', error);
    throw error;
  }
};

export const getTeacherSchedule = async (teacherPk?: number): Promise<any> => {
  try {
    // Backend still accepts ?faculty_pk for admin lookups; keep query param for compatibility
    const url = teacherPk ? `/teacher/me/schedule/?faculty_pk=${teacherPk}` : '/teacher/me/schedule/';
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch teacher schedule:', error);
    throw error;
  }
};

// Batch API helpers (backed by /course-loads/ endpoint)
export const fetchBatches = async (): Promise<any[]> => {
  try {
    const response = await api.get('/course-loads/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch batches (course loads):', error);
    throw error;
  }
};

export const createBatch = async (payload: any): Promise<any> => {
  try {
    const response = await api.post('/course-loads/', payload);
    return response.data;
  } catch (error) {
    console.error('Failed to create batch (course load):', error);
    throw error;
  }
};

export const updateBatch = async (id: number, payload: any): Promise<any> => {
  try {
    const response = await api.put(`/course-loads/${id}/`, payload);
    return response.data;
  } catch (error) {
    console.error('Failed to update batch (course load):', error);
    throw error;
  }
};

export const deleteBatch = async (id: number): Promise<any> => {
  try {
    const response = await api.delete(`/course-loads/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete batch (course load):', error);
    throw error;
  }
};

// Use the ModelViewSet faculties endpoint (numeric ids)
export const fetchTeachers = async (): Promise<any[]> => {
  try {
    const response = await api.get('/faculties/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch teachers (faculties):', error);
    throw error;
  }
};

// Room management helpers
export const createRoom = async (payload: any): Promise<any> => {
  try {
    const response = await api.post('/rooms/', payload);
    return response.data;
  } catch (error) {
    console.error('Failed to create room:', error);
    throw error;
  }
};

export const updateRoom = async (id: number, payload: any): Promise<any> => {
  try {
    const response = await api.put(`/rooms/${id}/`, payload);
    return response.data;
  } catch (error) {
    console.error('Failed to update room:', error);
    throw error;
  }
};

export const deleteRoom = async (id: number): Promise<any> => {
  try {
    const response = await api.delete(`/rooms/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete room:', error);
    throw error;
  }
};

export const bulkUpload = async (file: File | null, rows?: any[]): Promise<any> => {
  try {
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      const response = await api.post('/timetable/bulk-upload/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return response.data;
    }
    if (rows) {
      const response = await api.post('/timetable/bulk-upload/', { rows });
      return response.data;
    }
    throw new Error('no file or rows provided');
  } catch (error) {
    console.error('Failed to bulk upload:', error);
    throw error;
  }
};

export const getBatchDiagnostic = async (batchId: string): Promise<any> => {
  try {
    const response = await api.get(`/diagnostics/batch/${encodeURIComponent(batchId)}/`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch batch diagnostic:', error);
    throw error;
  }
};

export const fetchRoomTypes = async (): Promise<any[]> => {
  try {
    const response = await publicApi.get('/room-types/');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch room types:', error);
    throw error;
  }
};

export const createRoomType = async (payload: { code: string; name: string }): Promise<any> => {
  try {
    const response = await api.post('/room-types/', payload);
    return response.data;
  } catch (error) {
    console.error('Failed to create room type:', error);
    throw error;
  }
};

export const updateRoomType = async (id: number, payload: { code?: string; name?: string }): Promise<any> => {
  try {
    const response = await api.put(`/room-types/${id}/`, payload);
    return response.data;
  } catch (error) {
    console.error('Failed to update room type:', error);
    throw error;
  }
};

export const deleteRoomType = async (id: number): Promise<any> => {
  try {
    const response = await api.delete(`/room-types/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete room type:', error);
    throw error;
  }
};


export default api;

// Allow runtime updates to the axios base URL (used by Settings UI)
export function setApiBaseUrl(url: string | null) {
  try {
    const base = url && url.length > 0 ? url : '/api';
    api.defaults.baseURL = base;
    publicApi.defaults.baseURL = base;
    if (typeof window !== 'undefined') {
      if (base === '/api') localStorage.removeItem('nexus_api_base');
      else localStorage.setItem('nexus_api_base', base);
    }
  } catch (e) {
    console.warn('setApiBaseUrl failed', e);
  }
}
