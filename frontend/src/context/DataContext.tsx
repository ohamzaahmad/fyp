import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as api from '../services/api.ts';
import { Department, Teacher, Building, ClassSession, MasterMap } from '../types.ts';
import { setRuntimeData } from '../constants.ts';
import { useAuth } from './AuthContext.tsx';

type DataContextType = {
  departments: Department[];
  teachers: Teacher[];
  faculty: Teacher[]; // backward compatibility
  buildings: Building[];
  initialClasses: ClassSession[];
  masterMap: MasterMap | null;
  rooms: any[];
  entries: any[];
  isLoading: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  refreshMasterMap: () => Promise<void>;
  refreshEntries: () => Promise<void>;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

function transformMasterMapToBuildings(map: MasterMap): Building[] {
  return Object.values(map).map((b: any) => ({
    id: b.id,
    name: b.name,
    floors: Object.values(b.floors || {}).map((f: any) => ({
      id: f.id,
      number: f.number,
      rooms: Object.values(f.rooms || {}).map((r: any) => ({
        id: r.id,
        buildingId: b.id,
        floorId: f.id,
        name: r.name,
        capacity: r.capacity,
      })),
    })),
  }));
}

function flattenSessionsFromMasterMap(map: MasterMap): ClassSession[] {
  const out: ClassSession[] = [];
  Object.values(map).forEach((b: any) => {
    Object.values(b.floors || {}).forEach((f: any) => {
      Object.values(f.rooms || {}).forEach((r: any) => {
        (r.sessions || []).forEach((s: any) => {
          out.push({
            id: s.id,
            subjectCode: s.subjectCode || s.subject_code || '',
            subjectName: s.subjectName || s.subject_name,
            batchId: s.batchId || s.batch_id || '',
            teacherId: s.teacherId || s.teacher_id || s.facultyId || s.faculty_id || '',
            roomId: s.roomId || s.room_id || r.id,
            startTime: s.startTime || s.start_time,
            durationMinutes: s.durationMinutes || s.duration_minutes || 60,
            isLocked: s.isLocked || s.is_locked || false,
          });
        });
      });
    });
  });
  return out;
}

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  // Primary collection is `teachers`. Keep `faculty` as a legacy alias used by older UI.
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [initialClasses, setInitialClasses] = useState<ClassSession[]>([]);
  const [masterMap, setMasterMap] = useState<MasterMap | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPublic = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [deps, facs, mm] = await Promise.all([
        api.fetchDepartments(),
        api.fetchTeachers(),
        api.getMasterTimetable(),
      ]);

      setDepartments(deps || []);
      // Normalize incoming list: ensure each teacher has `id` as string
      const normalized = (facs || []).map((f: any) => ({ id: String(f.id || f.pk || f._id || ''), name: f.name || f.fullName || '', department: f.department || 'Computer Science', tier: f.tier || 1, requestedSlots: f.requestedSlots || f.requested_slots || [] }));
      setTeachers(normalized);
      setMasterMap(mm || null);

      const bldgs = mm ? transformMasterMapToBuildings(mm) : [];
      const classes = mm ? flattenSessionsFromMasterMap(mm) : [];

      setBuildings(bldgs);
      setInitialClasses(classes);

      setRuntimeData({ DEPARTMENTS: deps, FACULTY: facs, BUILDINGS: bldgs, INITIAL_CLASSES: classes });
    } catch (e: any) {
      setError(String(e));
      console.warn('DataProvider: failed to load public data', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadProtected = useCallback(async () => {
    setIsLoading(true);
    try {
      const roomsRes = await api.fetchRooms();
      setRooms(roomsRes || []);

      // transform rooms into BUILDINGS shape
      const byB: Record<string, any> = {};
      (roomsRes || []).forEach((r: any) => {
        const bId = r.buildingId || r.building_id || (r.floor && r.floor.building) || 'unknown';
        const fId = r.floorId || r.floor_id || (r.floor && r.floor.id) || 'f1';
        if (!byB[bId]) byB[bId] = { id: bId, name: r.buildingName || bId, floors: {} };
        if (!byB[bId].floors[fId]) byB[bId].floors[fId] = { id: fId, number: r.floorNumber || 1, rooms: [] };
        byB[bId].floors[fId].rooms.push({ id: r.id, buildingId: bId, floorId: fId, name: r.name || r.roomName || r.id, capacity: r.capacity || 0 });
      });

      const bldgs: Building[] = Object.values(byB).map((b: any) => ({
        id: b.id,
        name: b.name,
        floors: Object.values(b.floors).map((f: any) => ({
          id: f.id,
          number: f.number,
          rooms: (f.rooms || []).map((r: any) => ({
            id: r.id,
            buildingId: r.buildingId,
            floorId: r.floorId,
            name: r.name,
            capacity: r.capacity,
          })),
        })),
      }));

      setBuildings(bldgs);
      setRuntimeData({ BUILDINGS: bldgs });

      // Load authenticated-only entries if available
      try {
        const entriesRes = await api.fetchEntries();
        setEntries(entriesRes || []);
      } catch (e) {
        console.warn('DataProvider: failed to load entries', e);
      }
    } catch (e) {
      console.warn('DataProvider: failed to load protected data', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshEntries = useCallback(async () => {
    try {
      const e = await api.fetchEntries();
      setEntries(e || []);
    } catch (e) {
      console.warn('DataProvider: failed to refresh entries', e);
    }
  }, []);

  useEffect(() => {
    loadPublic();
  }, [loadPublic]);

  useEffect(() => {
    if (isAuthenticated) loadProtected();
  }, [isAuthenticated, loadProtected]);

  const refreshAll = useCallback(async () => {
    await loadPublic();
    if (isAuthenticated) await loadProtected();
  }, [isAuthenticated, loadPublic, loadProtected]);

  const refreshMasterMap = useCallback(async () => {
    await loadPublic();
  }, [loadPublic]);

  // Expose `faculty` as a legacy alias to maintain compatibility with older UI pieces
  return (
    <DataContext.Provider value={{ departments, teachers, faculty: teachers, buildings, initialClasses, masterMap, rooms, entries, isLoading, error, refreshAll, refreshMasterMap, refreshEntries }}>
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
