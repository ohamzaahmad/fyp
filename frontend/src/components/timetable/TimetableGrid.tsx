import React, { useMemo, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { moveClass } from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';
import { ClassSession, MasterMap } from '../../types.ts';
import { TimeSlotCard } from './TimeSlotCard.tsx';
import { cn } from '../../lib/utils.ts';
import { Building as BuildingIcon, Maximize2, Minimize2, ChevronDown, ChevronRight, Code2, LayoutGrid, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';

interface TimetableGridProps {
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  classes: ClassSession[];
  onClassesChange: (classes: ClassSession[]) => void;
  onToggleLock: (id: string) => void;
  collapsedBuildings: Set<string>;
  onToggleBuilding: (id: string) => void;
  masterMap?: MasterMap;
}

const START_HOUR = 8;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const MINUTE_WIDTH = 2; // base px per minute

export const TimetableGrid: React.FC<TimetableGridProps> = ({ 
  zoomLevel, 
  onZoomChange,
  classes,
  onClassesChange,
  onToggleLock,
  collapsedBuildings,
  onToggleBuilding,
  masterMap
}) => {
  const { user } = useAuth();
  const data = useData();
  const pixelsPerMinute = MINUTE_WIDTH * zoomLevel;
  const hourWidth = 60 * pixelsPerMinute;
  const totalWidth = HOURS.length * hourWidth;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const displayDepartments = useMemo(() => {
    const mm = data?.masterMap || masterMap || {};
    return Object.values(mm).map(d => ({
      id: d.id,
      name: d.name,
      floors: Object.values(d.floors || {}).map(f => ({
        id: f.id,
        number: f.number,
        rooms: Object.values(f.rooms || {})
      }))
    }));
  }, [masterMap, data?.masterMap]);

  // Ensure we only fetch master map when this component is mounted and we don't have it yet.
  React.useEffect(() => {
    if (!data?.masterMap || Object.keys(data.masterMap).length === 0) {
      data?.refreshMasterMap?.();
    }
  }, [data?.masterMap, data?.refreshMasterMap]);

  const toast = useToast();

  const handleDragEnd = async (event: any) => {
    try {
      const { active } = event;
      if (!active) return;
      const id = String(active.id);
      const el = document.getElementById(id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let target = document.elementFromPoint(centerX, centerY) as HTMLElement | null;
      while (target && !target.dataset?.roomId) {
        target = target.parentElement;
      }

      const newRoomId = target?.dataset?.roomId || undefined;
      if (!target) {
        // couldn't find a room - refresh data and exit
        await data?.refreshMasterMap?.();
        return;
      }

      const timelineRect = target.getBoundingClientRect();
      const minutesFromStart = Math.round((rect.left - timelineRect.left) / pixelsPerMinute);
      const totalMinutes = Math.max(START_HOUR * 60, START_HOUR * 60 + minutesFromStart);
      const hh = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
      const mm = (totalMinutes % 60).toString().padStart(2, '0');
      const newTime = `${hh}:${mm}`;

      // Optimistic UI update
      const updated = classes.map((c) => c.id === id ? { ...c, startTime: newTime, roomId: newRoomId } : c);
      onClassesChange(updated);

      // Persist to server
      try {
        await moveClass(id, newTime, newRoomId);
        await data?.refreshMasterMap?.();
      } catch (e: any) {
        toast.show?.('Failed to move class: ' + (e?.message || String(e)), 'error');
        // revert by refreshing from server
        await data?.refreshMasterMap?.();
      }
    } catch (e) {
      console.warn('Drag end handler failed', e);
    }
  };

  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
      {/* Toolbar: Debug Toggle */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50/70">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-auto">Timetable</span>
        <button
          onClick={() => setShowDebug(false)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
            !showDebug ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-100'
          )}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          Visual
        </button>
        <button
          onClick={() => setShowDebug(true)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
            showDebug ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-100'
          )}
        >
          <Code2 className="w-3.5 h-3.5" />
          Raw Data
        </button>
      </div>

      {showDebug ? (
        <div className="flex-1 overflow-auto p-6 bg-slate-950">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-emerald-400 font-mono">MasterMap — Raw Data</h3>
            <button
              onClick={() => data?.refreshMasterMap?.()}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
          {data?.isLoading && <p className="text-slate-400 text-sm font-mono">Loading...</p>}
          {data?.error && <p className="text-rose-400 text-sm font-mono">Error: {data.error}</p>}
          {data?.masterMap && (
            <pre className="text-xs text-emerald-300 font-mono leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(data.masterMap, null, 2)}
            </pre>
          )}
          {!data?.isLoading && !data?.error && !data?.masterMap && (
            <p className="text-slate-500 text-sm font-mono">No timetable data available.</p>
          )}
        </div>
      ) : (
      <>
      <div className="flex-1 overflow-auto no-scrollbar scroll-smooth" id="grid-container">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="min-w-max flex flex-col" style={{ width: `calc(${totalWidth}px + 140px)` }}>
            
            <div className="sticky top-0 z-30 flex bg-white border-b border-slate-200">
              <div className="w-[140px] h-10 bg-slate-50 border-r border-slate-200 flex items-center justify-center sticky left-0 z-40">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Dept / Room</span>
              </div>
              <div className="flex-1 flex divide-x divide-slate-100">
                {HOURS.map((hour) => (
                   <div key={hour} style={{ width: `${hourWidth}px` }} className="relative">
                      <div className="text-center py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                   </div>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col">
                {displayDepartments.map((dept: any) => {
                const isCollapsed = collapsedBuildings.has(dept.id);
                const deptFloors = dept.floors || [];
                
                return (
                  <div key={dept.id} className="flex flex-col">
                    <div 
                      onClick={() => onToggleBuilding(dept.id)}
                      className="h-8 bg-slate-100 flex items-center px-4 border-b border-slate-200 sticky left-0 z-20 cursor-pointer group/header"
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? <ChevronRight className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                        <BuildingIcon className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{dept.name}</span>
                      </div>
                    </div>
 
                    {!isCollapsed && deptFloors.map((floor: any) => {
                      const floorRooms = floor.rooms || [];
                      return (
                        <React.Fragment key={floor.id}>
                          <div className="h-6 bg-slate-50/50 flex items-center px-8 border-b border-slate-200/50 sticky left-0 z-20">
                             <span className="text-[9px] font-bold uppercase text-slate-400 tracking-tight">Floor {floor.number}</span>
                          </div>
                          
                          {floorRooms.map((room: any) => {
                            const roomSessions = room.sessions || [];
                            
                            return (
                              <div key={room.id} className="flex border-b border-slate-100 h-16 group hover:bg-slate-50/30 transition-colors">
                                <div className="w-[140px] px-4 border-r border-slate-200 bg-white sticky left-0 z-10 flex flex-col justify-center transition-colors group-hover:bg-slate-50">
                                  <span className="text-xs font-black text-slate-900 tracking-tighter">{room.name}</span>
                                  <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Cap: {room.capacity}</span>
                                </div>
 
                                <div data-room-id={room.id} className="flex-1 relative bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px)] bg-[size:10%_100%]">
                                  {roomSessions.map((session: any) => {
                                    const [h, m] = session.startTime.split(':').map(Number);
                                    const leftOffset = ((h - START_HOUR) * 60 + m) * pixelsPerMinute;
                                    return (
                                      <div 
                                        key={session.id}
                                        className="absolute inset-y-0"
                                        style={{ left: `${leftOffset}px` }}
                                      >
                                        <TimeSlotCard 
                                          session={session} 
                                          zoomLevel={zoomLevel} 
                                          pixelsPerMinute={pixelsPerMinute}
                                          onToggleLock={onToggleLock}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </DndContext>
      </div>

      <div className="absolute bottom-12 right-8 flex items-center gap-3 bg-white border border-slate-300 px-4 py-2 rounded shadow-2xl z-40 transition-transform hover:scale-105">
        <button 
          onClick={() => onZoomChange(Math.max(0.5, zoomLevel - 0.1))}
          className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <input 
            type="range" 
            min="0.5" 
            max="2" 
            step="0.1" 
            value={zoomLevel}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            className="w-32 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <span className="text-[10px] font-mono font-bold text-slate-400 w-8">{Math.round(zoomLevel * 100)}%</span>
        </div>
        <button 
          onClick={() => onZoomChange(Math.min(2, zoomLevel + 0.1))}
          className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      </>
      )}
    </div>
  );
};

export default TimetableGrid;
