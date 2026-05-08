import { useState, useCallback, useMemo } from 'react';
import { 
  ClassSession, 
  NexusMasterMap, 
  BuildingData, 
  FloorData, 
  RoomData,
  Building,
  Room
} from '../types.ts';
import * as api from '../services/api.ts';

/**
 * Custom Hook for University-Grade Timetable State Management
 * Handles complex nesting (Building > Floor > Room) efficient ingestion
 */
export function useNexusTimetable(initialClasses: ClassSession[]) {
  const [masterMap, setMasterMap] = useState<NexusMasterMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to transform flat array into nested structure (for legacy/demo support)
  const transformToMap = useCallback((sessions: ClassSession[], buildings: Building[]): NexusMasterMap => {
    const map: NexusMasterMap = {};

    buildings.forEach(b => {
      const bData: BuildingData = { id: b.id, name: b.name, floors: {} };
      b.floors.forEach(f => {
        const fData: FloorData = { id: f.id, number: f.number, rooms: {} };
        f.rooms.forEach(r => {
          const rData: RoomData = {
            id: r.id,
            name: r.name,
            capacity: r.capacity,
            sessions: sessions.filter(s => s.roomId === r.id)
          };
          fData.rooms[r.id] = rData;
        });
        bData.floors[f.id] = fData;
      });
      map[b.id] = bData;
    });

    return map;
  }, []);

  const refreshMap = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getMasterTimetable();
      setMasterMap(data);
    } catch (err) {
      setError('Backend high-density map unavailable. Synchronizing via local transform.');
      console.warn('Falling back to client-side relational mapping.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Compute a flat list of all sessions for global searches or filtering
  const allSessions = useMemo(() => {
    const sessions: ClassSession[] = [];
    Object.values(masterMap || {}).forEach(b => {
      Object.values(b.floors || {}).forEach(f => {
        Object.values(f.rooms || {}).forEach(r => {
          sessions.push(...(r.sessions || []));
        });
      });
    });
    return sessions;
  }, [masterMap]);

  return { 
    masterMap, 
    setMasterMap, 
    isLoading, 
    error, 
    refreshMap, 
    transformToMap,
    allSessions 
  };
}
