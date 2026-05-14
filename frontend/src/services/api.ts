import axios from 'axios';
import { ClassSession, Department, Teacher, MasterMap, Room, Course, Batch, CourseAssignment } from '../types.ts';
import { logout, getStoredToken, refreshToken } from './authService.ts';

const RUNTIME_API_OVERRIDE = (typeof window !== 'undefined' && localStorage.getItem('nexus_api_base')) || null;
const API_BASE_URL = RUNTIME_API_OVERRIDE || ((import.meta as any).env?.VITE_API_URL as string) || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  const response = await publicApi.get('/timetable/master-map/');
  return response.data;
};

export const moveClass = async (id: string, newTime: string, roomId?: string): Promise<ClassSession> => {
  const response = await api.patch(`/timetable/${id}/move/`, { startTime: newTime, roomId });
  return response.data;
};

export const createEntry = async (payload: {
  assignment: number;
  room: number;
  day_of_week: string;
  start_time: string;
  duration_minutes: number;
}): Promise<any> => {
  const response = await api.post('/entries/', payload);
  return response.data;
};

export const updateEntry = async (id: string | number, payload: Partial<{
  assignment: number;
  room: number;
  day_of_week: string;
  start_time: string;
  duration_minutes: number;
  is_locked: boolean;
  is_merged: boolean;
}>): Promise<any> => {
  // Clean ID if it has 'entry-' prefix
  const cleanId = String(id).replace('entry-', '');
  const response = await api.patch(`/entries/${cleanId}/`, payload);
  return response.data;
};

export const deleteEntry = async (id: string | number): Promise<any> => {
  const cleanId = String(id).replace('entry-', '');
  const response = await api.delete(`/entries/${cleanId}/`);
  return response.data;
};

export const mergeEntries = async (entryIds: string[]): Promise<any> => {
  // Backend should handle merging by marking entries as merged
  const response = await api.patch('/timetable/merge/', { entry_ids: entryIds });
  return response.data;
};


export const generateSchedule = async (options?: any): Promise<{ status: string; task_id: string }> => {
  const response = await api.post('/timetable/generate/', options || {});
  return response.data;
};

export const fetchDepartments = async (): Promise<Department[]> => {
  const response = await publicApi.get('/departments/');
  return response.data;
};

export const fetchDepartmentsRaw = fetchDepartments;

export const createDepartment = async (payload: Partial<Department>) => {
  const response = await api.post('/departments/', payload);
  return response.data;
};

export const deleteDepartment = async (id: number) => {
  const response = await api.delete(`/departments/${id}/`);
  return response.data;
};

export const fetchFloors = async () => {
  const response = await api.get('/floors/');
  return response.data;
};

export const fetchRooms = async (): Promise<Room[]> => {
  const response = await api.get('/rooms/');
  return response.data;
};

export const fetchCourses = async (): Promise<Course[]> => {
  const response = await api.get('/courses/');
  return response.data;
};

export const createCourse = async (payload: Partial<Course>) => {
  const response = await api.post('/courses/', payload);
  return response.data;
};

export const updateCourse = async (id: number | string, payload: Partial<Course>) => {
  const response = await api.patch(`/courses/${id}/`, payload);
  return response.data;
};

export const deleteCourse = async (id: number | string) => {
  const response = await api.delete(`/courses/${id}/`);
  return response.data;
};

export const fetchBatches = async (): Promise<Batch[]> => {
  const response = await api.get('/batches/');
  return response.data;
};

export const updateBatch = async (id: number | string, payload: Partial<Batch>) => {
  const response = await api.patch(`/batches/${id}/`, payload);
  return response.data;
};

export const fetchTeachers = async (): Promise<Teacher[]> => {
  const response = await api.get('/faculties/');
  return response.data;
};

export const createTeacher = async (payload: Partial<Teacher>) => {
  const response = await api.post('/faculties/', payload);
  return response.data;
};

export const updateTeacher = async (id: number | string, payload: Partial<Teacher>) => {
  const response = await api.patch(`/faculties/${id}/`, payload);
  return response.data;
};

export const deleteTeacher = async (id: number | string) => {
  const response = await api.delete(`/faculties/${id}/`);
  return response.data;
};

export const fetchAssignments = async (): Promise<CourseAssignment[]> => {
  const response = await api.get('/assignments/');
  return response.data;
};

export const fetchEntries = async (): Promise<any[]> => {
  const response = await api.get('/entries/');
  return response.data;
};

export const getAnalyticsSummary = async (): Promise<any> => {
  const response = await api.get('/analytics/summary/');
  return response.data;
};

export const getAnalyticsLogs = async () => (await api.get('/analytics/summary/')).data?.logs || [];
export const getAnalyticsLoadDistribution = async () => (await api.get('/analytics/summary/')).data?.load_distribution || {};
export const getAnalyticsFeed = async () => (await api.get('/analytics/summary/')).data?.feed || [];

export const getBatchDiagnostic = async (id: string | number) => {
  const response = await api.get(`/batches/${id}/`);
  return response.data;
};

export const getTeacherSchedule = async (id: string | number) => {
  const response = await api.get(`/faculties/${id}/`);
  return response.data;
};

export const setApiBaseUrl = (url: string) => {
  localStorage.setItem('nexus_api_base', url);
  window.location.reload();
};

export const bulkUpload = async (file: File | null, rows?: any[]) => {
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
};

export default api;

export const fetchSystemSettings = async (): Promise<any> => {
  const response = await publicApi.get('/timetable/settings/');
  return response.data;
};

export const updateSystemSettings = async (payload: any): Promise<any> => {
  const response = await api.post('/timetable/settings/', payload);
  return response.data;
};
