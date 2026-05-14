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

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [deps, facs, mm, rms, crs, bts, asgs, settings] = await Promise.all([
        api.fetchDepartments(),
        api.fetchTeachers(),
        api.getMasterTimetable(),
        api.fetchRooms(),
        api.fetchCourses(),
        api.fetchBatches(),
        api.fetchAssignments(),
        api.fetchSystemSettings()
      ]);

      setDepartments(deps || []);
      setTeachers(facs || []);
      setMasterMap(mm || null);
      setRooms(rms || []);
      setCourses(crs || []);
      setBatches(bts || []);
      setAssignments(asgs || []);
      setSystemSettings(settings || null);

      // Derive sessions from timetable data
      if (mm) {
        const derived: ClassSession[] = [];
        Object.values(mm).forEach(dept => {
          Object.values(dept.floors).forEach(floor => {
            Object.values(floor.rooms).forEach(room => {
              derived.push(...(room.sessions || []));
            });
          });
        });
        setSessions(derived);
      }
    } catch (e: any) {
      setError(String(e));
      console.warn('Failed to load application data', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const refreshAll = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const refreshMasterMap = useCallback(async () => {
    try {
      const mm = await api.getMasterTimetable();
      setMasterMap(mm || null);
    } catch (e) {
      console.warn('Failed to refresh timetable data', e);
    }
  }, []);

  return (
    <DataContext.Provider value={{ 
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
      refreshMasterMap 
    }}>
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
