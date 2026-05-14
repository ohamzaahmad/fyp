import { useState, useCallback, useMemo } from 'react';
import { 
  ClassSession, 
  MasterMap, 
  DepartmentData, 
  FloorData, 
  RoomData,
  Department
} from '../types.ts';
import * as api from '../services/api.ts';

/**
 * Custom Hook for University-Grade Timetable State Management
 * Handles complex nesting (Department > Floor > Room) efficient ingestion
 */
export function useNexusTimetable(initialClasses: ClassSession[]) {
  const [masterMap, setMasterMap] = useState<MasterMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMap = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getMasterTimetable();
      setMasterMap(data);
    } catch (err) {
      setError('Backend high-density map unavailable.');
      console.warn('Backend sync failed.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Compute a flat list of all sessions for global searches or filtering
  const allSessions = useMemo(() => {
    const sessions: ClassSession[] = [];
    Object.values(masterMap || {}).forEach(d => {
      Object.values(d.floors || {}).forEach(f => {
        Object.values(f.rooms || {}).forEach(r => {
          if (r.days) {
            Object.values(r.days).forEach(daySessions => {
              sessions.push(...(daySessions as ClassSession[]));
            });
          }
        });
      });
    });
    return sessions;
  }, [masterMap]);

  const transformToMap = useCallback((sessions: ClassSession[]) => {
    // This is a complex transformation that usually happens on the backend
    // For now we refresh the map to get the latest structure
    refreshMap();
  }, [refreshMap]);

  return { 
    masterMap, 
    setMasterMap, 
    isLoading, 
    error, 
    refreshMap, 
    allSessions,
    transformToMap
  };
}
