import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as api from '../services/api.ts';
import { Department, Teacher, ClassSession, MasterMap, Room, Course, Batch, CourseAssignment } from '../types.ts';
import { useAuth } from './AuthContext.tsx';

type DataContextType = {
  departments: Department[];
  teachers: Teacher[];
  rooms: Room[];
  courses: Course[];
  batches: Batch[];
  assignments: CourseAssignment[];
  masterMap: MasterMap | null;
  systemSettings: any;
  /** All class sessions derived from the current timetable */
  sessions: ClassSession[];
  isLoading: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  refreshMasterMap: () => Promise<void>;
  fetchDepartments: () => Promise<Department[]>;
  fetchTeachers: () => Promise<Teacher[]>;
  fetchRooms: () => Promise<Room[]>;
  fetchFloors: () => Promise<any[]>;
  fetchCourses: () => Promise<Course[]>;
  fetchBatches: () => Promise<Batch[]>;
  fetchAssignments: () => Promise<CourseAssignment[]>;
  fetchSystemSettings: () => Promise<any>;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [masterMap, setMasterMap] = useState<MasterMap | null>(null);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-resource fetchers. Components should call the fetch they need.
  const fetchDepartments = useCallback(async () => {
    try {
      const deps = await api.fetchDepartments();
      setDepartments(deps || []);
      return deps || [];
    } catch (e) {
      console.warn('fetchDepartments failed', e);
      return [];
    }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const facs = await api.fetchTeachers();
      setTeachers(facs || []);
      return facs || [];
    } catch (e) {
      console.warn('fetchTeachers failed', e);
      return [];
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const rms = await api.fetchRooms();
      setRooms(rms || []);
      return rms || [];
    } catch (e) {
      console.warn('fetchRooms failed', e);
      return [];
    }
  }, []);

  const fetchFloors = useCallback(async () => {
    try {
      const fls = await api.fetchFloors();
      // floors are not stored globally but components can retrieve
      return fls || [];
    } catch (e) {
      console.warn('fetchFloors failed', e);
      return [];
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const crs = await api.fetchCourses();
      setCourses(crs || []);
      return crs || [];
    } catch (e) {
      console.warn('fetchCourses failed', e);
      return [];
    }
  }, []);

  const fetchBatches = useCallback(async () => {
    try {
      const bts = await api.fetchBatches();
      setBatches(bts || []);
      return bts || [];
    } catch (e) {
      console.warn('fetchBatches failed', e);
      return [];
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      const asgs = await api.fetchAssignments();
      setAssignments(asgs || []);
      return asgs || [];
    } catch (e) {
      console.warn('fetchAssignments failed', e);
      return [];
    }
  }, []);

  const fetchSystemSettings = useCallback(async () => {
    try {
      const settings = await api.fetchSystemSettings();
      setSystemSettings(settings || null);
      return settings || null;
    } catch (e) {
      console.warn('fetchSystemSettings failed', e);
      return null;
    }
  }, []);

  const refreshMasterMap = useCallback(async () => {
    try {
      const mm = await api.getMasterTimetable();
      setMasterMap(mm || null);
      // derive sessions when master map is updated
      if (mm) {
        const derived: ClassSession[] = [];
        Object.values(mm).forEach(dept => {
          Object.values(dept.floors).forEach((floor: any) => {
            Object.values((floor as any).rooms).forEach((room: any) => {
              derived.push(...(room.sessions || []));
            });
          });
        });
        setSessions(derived);
      } else {
        setSessions([]);
      }
    } catch (e) {
      console.warn('Failed to refresh timetable data', e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchDepartments(),
        fetchTeachers(),
        refreshMasterMap(),
        fetchRooms(),
        fetchCourses(),
        fetchBatches(),
        fetchAssignments(),
        fetchSystemSettings()
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchDepartments, fetchTeachers, refreshMasterMap, fetchRooms, fetchCourses, fetchBatches, fetchAssignments, fetchSystemSettings]);

  return (
    <DataContext.Provider value={React.useMemo(() => ({ 
      departments, 
      teachers, 
      rooms, 
      courses, 
      batches, 
      assignments, 
      masterMap, 
      sessions,
      systemSettings,
      isLoading, 
      error, 
      refreshAll, 
      refreshMasterMap,
      fetchDepartments,
      fetchTeachers,
      fetchRooms,
      fetchFloors,
      fetchCourses,
      fetchBatches,
      fetchAssignments,
      fetchSystemSettings
    }), [
      departments,
      teachers,
      rooms,
      courses,
      batches,
      assignments,
      masterMap,
      sessions,
      systemSettings,
      isLoading,
      error,
      refreshAll,
      refreshMasterMap,
      fetchDepartments,
      fetchTeachers,
      fetchRooms,
      fetchFloors,
      fetchCourses,
      fetchBatches,
      fetchAssignments,
      fetchSystemSettings
    ])}>
      {children}
    </DataContext.Provider>
  );
};

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

export default DataContext;
