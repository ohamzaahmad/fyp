import React, { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { BUILDINGS, INITIAL_CLASSES } from '../../constants.ts';
import { ClassSession, Room, NexusMasterMap } from '../../types.ts';
import { TimeSlotCard } from './TimeSlotCard.tsx';
import { cn } from '../../lib/utils.ts';
import { Building as BuildingIcon, Users, Maximize2, Minimize2, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { timeToMinutes } from '../../services/timetableLogic.ts';
import * as api from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface QuantumGridProps {
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  classes: ClassSession[];
  onClassesChange: (classes: ClassSession[]) => void;
  onToggleLock: (id: string) => void;
  collapsedBuildings: Set<string>;
  onToggleBuilding: (id: string) => void;
  masterMap?: NexusMasterMap;
}

const START_HOUR = 8;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const MINUTE_WIDTH = 2; // base px per minute

export const QuantumGrid: React.FC<QuantumGridProps> = ({ 
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

  const displayBuildings = useMemo(() => {
    let baseMap = masterMap && Object.keys(masterMap).length > 0
      ? Object.values(masterMap)
      : BUILDINGS.map(b => ({
          ...b,
          floors: b.floors.map(f => ({
            ...f,
            rooms: f.rooms.map(r => ({
              ...r,
              sessions: classes.filter(s => s.roomId === r.id)
            }))
          }))
        }));

    // If teacher, only show buildings/rooms where they have a class
    if (user?.role === 'TEACHER') {
      return baseMap.map(b => ({
        ...b,
        floors: Object.values(b.floors).map(f => ({
          ...f,
          rooms: Object.values(f.rooms).filter(r => 
            r.sessions.some(s => s.facultyName === user.name)
          ).map(r => ({
            ...r,
            sessions: r.sessions.filter(s => s.facultyName === user.name)
          }))
        })).filter(f => f.rooms.length > 0)
      })).filter(b => b.floors.length > 0);
    }

    return baseMap;
  }, [masterMap, classes, user]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta } = event;
    const session = active.data.current as ClassSession;
    if (!session || session.isLocked || user?.role === 'TEACHER') return;

    const minutesMoved = Math.round(delta.x / pixelsPerMinute / 10) * 10;
    const startMinutes = timeToMinutes(session.startTime);
    const newStartMinutes = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - session.durationMinutes, startMinutes + minutesMoved));

    const h = Math.floor(newStartMinutes / 60);
    const m = newStartMinutes % 60;
    const newStartTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    
    // Optimistically update local state
    onClassesChange(classes.map(c => 
      c.id === active.id ? { ...c, startTime: newStartTime } : c
    ));

    // Sync with backend
    try {
      await api.moveClass(session.id, newStartTime);
    } catch (err) {
      console.error('Failed to sync move with server:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
      <div className="flex-1 overflow-auto no-scrollbar scroll-smooth" id="grid-container">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="min-w-max flex flex-col" style={{ width: `calc(${totalWidth}px + 140px)` }}>
            
            {/* Timeline Header (Sticky Top) */}
            <div className="sticky top-0 z-30 flex bg-white border-b border-slate-200">
              <div className="w-[140px] h-10 bg-slate-50 border-r border-slate-200 flex items-center justify-center sticky left-0 z-40">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Room / Time</span>
              </div>
              <div className="flex-1 flex divide-x divide-slate-100">
                {HOURS.map((hour) => (
                   <div key={hour} style={{ width: `${hourWidth}px` }} className="relative">
                      <div className={cn(
                        "text-center py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-widest",
                        hour === 13 ? "bg-rose-50/50 text-rose-900 border-x border-rose-100/50" : ""
                      )}>
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      {hour === 13 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                           <span className="text-[7px] font-black text-rose-300 uppercase tracking-[0.3em] rotate-90">Break</span>
                        </div>
                      )}
                   </div>
                ))}
              </div>
            </div>

            {/* Grid Body */}
            <div className="flex-1 flex flex-col">
              {displayBuildings.map(building => {
                const isCollapsed = collapsedBuildings.has(building.id);
                const buildingFloors = Object.values(building.floors || {});
                
                return (
                  <div key={building.id} className="flex flex-col">
                    {/* Building Header */}
                    <div 
                      onClick={() => onToggleBuilding(building.id)}
                      className="h-8 bg-slate-100 flex items-center px-4 border-b border-slate-200 sticky left-0 z-20 cursor-pointer group/header"
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? <ChevronRight className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                        <BuildingIcon className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{building.name}</span>
                        <div className="h-3 w-[1px] bg-slate-300 mx-1" />
                        <span className="text-[9px] font-bold text-slate-400">{(buildingFloors || []).length} Floors</span>
                      </div>
                    </div>
 
                    {!isCollapsed && buildingFloors.map(floor => {
                      const floorRooms = Object.values(floor.rooms || {});
                      return (
                        <React.Fragment key={floor.id}>
                          <div className="h-6 bg-slate-50/50 flex items-center px-8 border-b border-slate-200/50 sticky left-0 z-20">
                             <span className="text-[9px] font-bold uppercase text-slate-400 tracking-tight">Floor {floor.number}</span>
                          </div>
                          
                          {floorRooms.map(room => {
                            const roomSessions = room.sessions || [];
                            
                            return (
                              <div key={room.id} className="flex border-b border-slate-100 h-16 group hover:bg-slate-50/30 transition-colors">
                                {/* Room Metadata Column (Sticky Left) */}
                                <div className="w-[140px] px-4 border-r border-slate-200 bg-white sticky left-0 z-10 flex flex-col justify-center transition-colors group-hover:bg-slate-50">
                                  <span className="text-xs font-black text-slate-900 tracking-tighter">{room.name}</span>
                                  <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Cap: {room.capacity}</span>
                                </div>
 
                                {/* Timeline Interaction Grid */}
                                <div className="flex-1 relative bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px)] bg-[size:10%_100%]">
                                  {/* Vertical Hour Grids */}
                                  <div className="absolute inset-0 flex divide-x divide-slate-100/50 pointer-events-none">
                                     {HOURS.map(h => (
                                       <div key={h} className="flex-1 h-full flex divide-x divide-slate-50/30" style={{ width: `${hourWidth}px` }}>
                                          <div className="flex-1" />
                                          <div className="flex-1" />
                                       </div>
                                     ))}
                                  </div>
 
                                  {/* Lunch Break shading */}
                                  <div 
                                    className="absolute top-0 bottom-0 bg-rose-50/20 mix-blend-multiply border-x border-rose-100/30"
                                    style={{ 
                                      left: `${(13 - START_HOUR) * hourWidth}px`, 
                                      width: `${hourWidth}px` 
                                    }}
                                  />
 
                                  {/* Placed Sessions */}
                                  {roomSessions.map(session => {
                                    const [h, m] = session.startTime.split(':').map(Number);
                                    const leftOffset = ((h - START_HOUR) * 60 + m) * pixelsPerMinute;
 
                                    return (
                                      <div 
                                        key={session.id}
                                        className={cn("absolute inset-y-0", session.isLocked && "z-10")}
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

      {/* Grid Controls (Bottom Floating) */}
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
    </div>
  );
};
