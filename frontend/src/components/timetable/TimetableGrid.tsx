import React, { useMemo, useState, useCallback } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { moveClass } from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';
import { ClassSession, MasterMap } from '../../types.ts';
import { TimeSlotCard } from './TimeSlotCard.tsx';
import { AddSessionModal } from './AddSessionModal.tsx';
import { cn } from '../../lib/utils.ts';
import {
  Building as BuildingIcon,
  Maximize2, Minimize2, ChevronDown, ChevronRight,
  Code2, LayoutGrid, RefreshCw, Plus, AlertTriangle, GitMerge, ZapIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { TIME_SLOTS, getSlotRanges, parseTime } from '../../constants.ts';
import { motion, AnimatePresence } from 'motion/react';
import { checkConflicts } from '../../services/timetableLogic.ts';

interface TimetableGridProps {
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  classes: ClassSession[];
  onClassesChange: (classes: ClassSession[]) => void;
  onToggleLock: (id: string) => void;
  collapsedBuildings: Set<string>;
  onToggleBuilding: (id: string) => void;
  masterMap?: MasterMap;
  selectedDay: string;
  onDayChange: (day: string) => void;
}



const MINUTE_WIDTH = 2; // base px per minute

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  zoomLevel,
  onZoomChange,
  classes,
  onClassesChange,
  onToggleLock,
  collapsedBuildings,
  onToggleBuilding,
  masterMap,
  selectedDay,
  onDayChange
}) => {
  const { user } = useAuth();
  const data = useData();
  const DAYS = data?.systemSettings?.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const pixelsPerMinute = MINUTE_WIDTH * zoomLevel;
  const slotRanges = useMemo(() => getSlotRanges(), []);

  // Pre-compute cumulative left offsets for each slot (so we don't repeat the loop)
  const slotOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    TIME_SLOTS.forEach((_, idx) => {
      offsets.push(acc);
      const r = slotRanges[idx];
      acc += r ? (r.end - r.start) * pixelsPerMinute : 40 * pixelsPerMinute;
    });
    return offsets;
  }, [slotRanges, pixelsPerMinute]);

  const totalWidth = slotOffsets[slotOffsets.length - 1] + (() => {
    const lastIdx = TIME_SLOTS.length - 1;
    const r = slotRanges[lastIdx];
    return r ? (r.end - r.start) * pixelsPerMinute : 40 * pixelsPerMinute;
  })();

  const minMin = useMemo(() => {
    const valid = slotRanges.filter(Boolean);
    return valid.length ? Math.min(...valid.map(r => r!.start)) : 480;
  }, [slotRanges]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
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

  React.useEffect(() => {
    if (!data?.masterMap || Object.keys(data.masterMap).length === 0) {
      data?.refreshMasterMap?.();
    }
  }, []);

  const toast = useToast();

  // ─── Drag & Drop ──────────────────────────────────────────────────────────
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = (event: any) => {
    setDraggingId(String(event.active.id));
  };

  const handleDragEnd = async (event: any) => {
    setDraggingId(null);
    try {
      const { active, delta } = event;
      if (!active) return;
      const id = String(active.id);
      const el = document.getElementById(id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let target = document.elementFromPoint(centerX, centerY) as HTMLElement | null;
      while (target && !target.dataset?.roomId) target = target.parentElement;
      if (!target) { await data?.refreshMasterMap?.(); return; }

      const newRoomId = target.dataset.roomId!;
      const timelineRect = target.getBoundingClientRect();
      const droppedPx = rect.left - timelineRect.left;
      const droppedMinutes = minMin + droppedPx / pixelsPerMinute;

      // Snap to nearest slot
      const validSlots = slotRanges.filter(Boolean);
      const nearest = validSlots.reduce((prev, curr) =>
        Math.abs(curr!.start - droppedMinutes) < Math.abs(prev!.start - droppedMinutes) ? curr : prev
      );
      if (!nearest) return;

      const hh = Math.floor(nearest.start / 60).toString().padStart(2, '0');
      const mm = (nearest.start % 60).toString().padStart(2, '0');
      const newTime = `${hh}:${mm}`;

      const updated = classes.map(c => c.id === id ? { ...c, startTime: newTime, roomId: newRoomId } : c);
      onClassesChange(updated);

      try {
        await moveClass(id, newTime, newRoomId);
        await data?.refreshMasterMap?.();
        toast.show?.(`Moved to ${newTime}`, 'success');
      } catch (e: any) {
        toast.show?.('Failed to move: ' + (e?.message || String(e)), 'error');
        await data?.refreshMasterMap?.();
      }
    } catch (e) {
      console.warn('Drag end failed', e);
    }
  };

  // ─── Add Session Modal ────────────────────────────────────────────────────
  const [addModal, setAddModal] = useState<{
    open: boolean;
    roomId: string;
    roomName: string;
    slotLabel: string;
    startTime: string;
    editingSession?: ClassSession | null;
  }>({ open: false, roomId: '', roomName: '', slotLabel: '', startTime: '', editingSession: null });

  const openAddModal = useCallback((roomId: string, roomName: string, slotLabel: string, startTime: string) => {
    if (user?.role !== 'ADMIN') return; // only admins can add sessions
    setAddModal({ open: true, roomId, roomName, slotLabel, startTime, editingSession: null });
  }, [user]);

  const openEditModal = useCallback((session: ClassSession) => {
    if (user?.role !== 'ADMIN') return;
    setAddModal({ 
      open: true, 
      roomId: session.roomId, 
      roomName: '', // can be derived if needed
      slotLabel: '', 
      startTime: session.startTime,
      editingSession: session 
    });
  }, [user]);

  const closeAddModal = () => setAddModal(prev => ({ ...prev, open: false, editingSession: null }));

  // ─── Toolbar state ────────────────────────────────────────────────────────
  const [showDebug, setShowDebug] = useState(false);

  // ─── Enriched classes with conflicts ──────────────────────────────────────
  const enrichedClasses = useMemo(() => {
    return (classes || [])
      .filter(c => c.day_of_week === selectedDay || (c as any).dayOfWeek === selectedDay)
      .map(c => ({
        ...c,
        conflicts: checkConflicts(c, classes, data?.teachers)
      }));
  }, [classes, data?.teachers, selectedDay]);

  // ─── Conflict summary counts ──────────────────────────────────────────────
  const conflictStats = useMemo(() => {
    let critical = 0, warnings = 0;
    enrichedClasses.forEach(s => {
      (s.conflicts || []).forEach(c => {
        if (c.severity === 'Critical') critical++;
        else warnings++;
      });
    });
    return { critical, warnings };
  }, [enrichedClasses]);

  // Detect sessions whose roomId is not present in the masterMap (unmatched)
  const masterRoomsSet = useMemo(() => {
    const mm = data?.masterMap || masterMap || {};
    const set = new Set<string>();
    Object.values(mm).forEach((b: any) => {
      Object.values(b.floors || {}).forEach((f: any) => {
        Object.values(f.rooms || {}).forEach((r: any) => set.add(String(r.id)));
      });
    });
    return set;
  }, [data?.masterMap, masterMap]);

  const unmatchedSessions = useMemo(() => {
    if (!classes || classes.length === 0) return [];
    return classes.filter(c => {
      const rid = String((c as any).roomId ?? (c as any).room ?? (c as any).room_id ?? '');
      return rid && !masterRoomsSet.has(rid);
    });
  }, [classes, masterRoomsSet]);

  React.useEffect(() => {
    if (unmatchedSessions.length > 0) {
      console.warn('Unmatched sessions (room ids not found in masterMap):', unmatchedSessions);
    }
  }, [unmatchedSessions]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-1.5 mr-auto">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Timetable Grid</span>
        </div>

        {/* Conflict badge summary */}
        {conflictStats.critical > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 rounded-lg border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            <span className="text-[10px] font-black text-rose-600">{conflictStats.critical} Critical</span>
          </div>
        )}
        {conflictStats.warnings > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 rounded-lg border border-amber-200">
            <GitMerge className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] font-black text-amber-600">{conflictStats.warnings} Merge</span>
          </div>
        )}

        {/* Refresh */}
        <button
          onClick={() => data?.refreshMasterMap?.()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>

        <div className="flex items-center rounded-lg bg-slate-100 p-0.5 gap-0.5">
          {DAYS.map((day: string) => (
            <button
              key={day}
              onClick={() => onDayChange(day)}
              className={cn(
                'px-3 py-1.5 rounded-md text-[10px] font-black transition-all uppercase tracking-widest',
                selectedDay === day ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              {day}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-slate-200 mx-2" />

        {/* View toggle */}
        <div className="flex items-center rounded-lg bg-slate-100 p-0.5 gap-0.5">
          <button
            onClick={() => setShowDebug(false)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all',
              !showDebug ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <LayoutGrid className="w-3 h-3" />
            Visual
          </button>
          <button
            onClick={() => setShowDebug(true)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all',
              showDebug ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Code2 className="w-3 h-3" />
            Raw
          </button>
        </div>
      </div>

      {/* ── Legend bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-white border-b border-slate-100">
        {[
          { color: 'bg-emerald-500', label: 'Normal' },
          { color: 'bg-rose-500', label: 'Critical Conflict' },
          { color: 'bg-amber-400', label: 'Merge Candidate' },
          { color: 'bg-indigo-500', label: 'Merged' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn('w-2.5 h-2.5 rounded-sm', color)} />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
          </div>
        ))}
        {user?.role === 'ADMIN' && (
          <div className="ml-auto flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            <Plus className="w-3 h-3 text-emerald-500" />
            Click empty slot to add
          </div>
        )}
      </div>

      {/* Unmatched sessions (rooms referenced by sessions but missing in masterMap) */}
      {unmatchedSessions.length > 0 && (
        <div className="px-4 py-2 bg-red-50 border-t border-b border-red-200 text-red-800">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold">Unmatched sessions: {unmatchedSessions.length}</div>
            <button
              onClick={() => console.log('Unmatched sessions:', unmatchedSessions)}
              className="text-xs underline"
            >
              Log details
            </button>
          </div>
          <div className="text-xs mt-1">
            {unmatchedSessions.slice(0, 5).map((s: any) => (
              <div key={s.id ?? s.pk} className="truncate">{s.id ?? s.pk} — {s.subjectCode || s.subject || ''} — room: {String(s.roomId ?? s.room ?? s.room_id)}</div>
            ))}
            {unmatchedSessions.length > 5 && <div className="text-xs">...and {unmatchedSessions.length - 5} more</div>}
          </div>
        </div>
      )}

      {/* ── Debug view ───────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {showDebug ? (
          <motion.div
            key="debug"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-auto p-6 bg-slate-950"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-emerald-400 font-mono">MasterMap — Raw JSON</h3>
              <button
                onClick={() => data?.refreshMasterMap?.()}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
            <pre className="text-xs text-emerald-300 font-mono leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(data?.masterMap, null, 2)}
            </pre>
          </motion.div>
        ) : (

          /* ── Visual Grid ─────────────────────────────────────────────── */
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-auto" id="grid-container">
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="min-w-max flex flex-col" style={{ width: `calc(${totalWidth}px + 160px)` }}>

                  {/* ── Sticky header row ─────────────────────────────── */}
                  <div className="sticky top-0 z-30 flex bg-white border-b-2 border-slate-200 shadow-sm">
                    <div className="w-[160px] h-11 bg-white border-r-2 border-slate-200 flex items-center justify-center sticky left-0 z-40">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Room</span>
                    </div>
                    <div className="flex">
                      {TIME_SLOTS.map((slot, idx) => {
                        const range = slotRanges[idx];
                        const w = range ? (range.end - range.start) * pixelsPerMinute : 40 * pixelsPerMinute;
                        const isBreak = slot === 'Break';
                        return (
                          <div
                            key={idx}
                            style={{ width: `${w}px` }}
                            className={cn(
                              'border-r border-slate-100 flex items-center justify-center',
                              isBreak ? 'bg-slate-100' : 'bg-white'
                            )}
                          >
                            <div className={cn(
                              'text-center py-2 text-[9px] font-black uppercase tracking-widest whitespace-nowrap px-1 leading-tight',
                              isBreak ? 'text-slate-400' : 'text-slate-600'
                            )}>
                              {isBreak ? '☕ Break' : slot}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Department / Room rows ────────────────────────── */}
                  <div className="flex-1 flex flex-col">
                    {displayDepartments.map((dept: any) => {
                      const isCollapsed = collapsedBuildings.has(dept.id);
                      return (
                        <div key={dept.id} className="flex flex-col">

                          {/* Dept header */}
                          <div
                            onClick={() => onToggleBuilding(dept.id)}
                            className="h-9 bg-slate-100 border-b border-slate-200 flex items-center px-4 sticky left-0 z-20 cursor-pointer hover:bg-slate-200/70 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isCollapsed
                                ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                              <BuildingIcon className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-[11px] font-black uppercase text-slate-700 tracking-widest">{dept.name}</span>
                              <span className="text-[9px] text-slate-400 font-bold ml-1">
                                ({dept.floors.reduce((a: number, f: any) => a + f.rooms.length, 0)} rooms)
                              </span>
                            </div>
                          </div>

                          {!isCollapsed && dept.floors.map((floor: any) => (
                            <React.Fragment key={floor.id}>
                              {/* Floor sub-header */}
                              <div className="h-6 bg-slate-50 border-b border-slate-100 flex items-center px-6 sticky left-0 z-10">
                                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">
                                  Floor {floor.number}
                                </span>
                              </div>

                              {floor.rooms.map((room: any) => {
                                 const roomSessions = (room.days?.[selectedDay] || []).map((s: any) => ({
                                   ...s,
                                   conflicts: checkConflicts(s, classes, data?.teachers)
                                 }));
                                 const roomHasCritical = roomSessions.some(
                                   (s: any) => (s.conflicts || []).some((c: any) => c.severity === 'Critical')
                                 );
                                const roomHasMerge = roomSessions.some(
                                  (s: any) => (s.conflicts || []).some((c: any) => c.severity === 'Warning' && c.type === 'Room')
                                );

                                return (
                                  <div
                                    key={room.id}
                                    className={cn(
                                      'flex border-b border-slate-100 h-[60px] group hover:bg-slate-50/50 transition-colors relative hover:z-50',
                                      roomHasCritical && 'bg-rose-50/30 hover:bg-rose-50/50',
                                      roomHasMerge && !roomHasCritical && 'bg-amber-50/30 hover:bg-amber-50/50'
                                    )}
                                  >
                                    {/* Room label */}
                                    <div className={cn(
                                      'w-[160px] px-3 border-r-2 border-slate-200 sticky left-0 z-10 flex flex-col justify-center transition-colors',
                                      roomHasCritical
                                        ? 'bg-rose-50 border-rose-200'
                                        : roomHasMerge
                                        ? 'bg-amber-50 border-amber-200'
                                        : 'bg-white group-hover:bg-slate-50'
                                    )}>
                                      <span className="text-xs font-black text-slate-900 tracking-tighter">{room.name}</span>
                                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                                        Cap {room.capacity}
                                        {roomHasCritical && <span className="ml-1.5 text-rose-500">⚠</span>}
                                        {roomHasMerge && !roomHasCritical && <span className="ml-1.5 text-amber-500">⊕</span>}
                                      </span>
                                    </div>

                                    {/* Timeline area */}
                                    <div
                                      data-room-id={room.id}
                                      data-room-name={room.name}
                                      className="flex-1 relative"
                                    >
                                      {/* Slot dividers + clickable empty cells */}
                                      <div className="absolute inset-0 flex pointer-events-none">
                                        {TIME_SLOTS.map((slot, idx) => {
                                          const range = slotRanges[idx];
                                          const w = range ? (range.end - range.start) * pixelsPerMinute : 40 * pixelsPerMinute;
                                          const isBreak = slot === 'Break';
                                          return (
                                            <div
                                              key={idx}
                                              style={{ width: `${w}px` }}
                                              className={cn(
                                                'h-full border-r border-slate-100',
                                                isBreak && 'bg-slate-100/70'
                                              )}
                                            />
                                          );
                                        })}
                                      </div>

                                      {/* Clickable empty-slot overlays — only for ADMIN */}
                                      {user?.role === 'ADMIN' && (
                                        <div className="absolute inset-0 flex pointer-events-auto z-[1]">
                                          {TIME_SLOTS.map((slot, idx) => {
                                            const range = slotRanges[idx];
                                            if (!range || slot === 'Break') {
                                              const w = 40 * pixelsPerMinute;
                                              return <div key={idx} style={{ width: `${w}px` }} />;
                                            }
                                            const w = (range.end - range.start) * pixelsPerMinute;
                                            const slotHasSession = roomSessions.some((s: any) => {
                                              const sm = parseTime(s.startTime);
                                              return sm >= range.start && sm < range.end;
                                            });

                                            return (
                                              <div
                                                key={idx}
                                                style={{ width: `${w}px` }}
                                                onClick={() => {
                                                  if (!slotHasSession) {
                                                    const hh = Math.floor(range.start / 60).toString().padStart(2, '0');
                                                    const mm = (range.start % 60).toString().padStart(2, '0');
                                                    openAddModal(room.id, room.name, slot, `${hh}:${mm}`);
                                                  }
                                                }}
                                                className={cn(
                                                  'h-full group/slot transition-colors',
                                                  !slotHasSession && 'hover:bg-emerald-50/60 cursor-pointer'
                                                )}
                                              >
                                                {!slotHasSession && (
                                                  <div className="h-full flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity">
                                                    <Plus className="w-3 h-3 text-emerald-400" />
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}

                                      {/* Sessions */}
                                      {roomSessions.map((session: any) => {
                                        const sessionMin = parseTime(session.startTime);
                                        const startSlotIdx = slotRanges.findIndex(r => r && sessionMin >= r.start && sessionMin < r.end);
                                        if (startSlotIdx === -1) return null;

                                        // Left offset = sum of all slot widths before startSlotIdx
                                        const leftOffset = slotOffsets[startSlotIdx];

                                        // Width: walk forward through slots until we've covered
                                        // the full durationMinutes, accumulating pixel widths.
                                        // This correctly handles sessions that span 2 or 3 slots,
                                        // cross the Break gap, or overflow the grid.
                                        const sessionStartMin = sessionMin;
                                        const sessionEndMin = sessionStartMin + (session.durationMinutes || 50);
                                        let sessionWidth = 0;
                                        for (let i = startSlotIdx; i < slotRanges.length; i++) {
                                          const r = slotRanges[i];
                                          if (r === null) {
                                            // Break column — include it only if session continues past it
                                            const nextR = slotRanges[i + 1];
                                            if (nextR && nextR.start < sessionEndMin) {
                                              // session spans past the break — include break column width
                                              sessionWidth += 40 * pixelsPerMinute;
                                            }
                                            continue;
                                          }
                                          if (r.start >= sessionEndMin) break; // session ended before this slot
                                          // Clip to actual session coverage within this slot
                                          const coverStart = Math.max(r.start, sessionStartMin);
                                          const coverEnd = Math.min(r.end, sessionEndMin);
                                          sessionWidth += (coverEnd - coverStart) * pixelsPerMinute;
                                        }
                                        sessionWidth = Math.max(sessionWidth, 20); // minimum visible width


                                        return (
                                          <div
                                            key={session.id}
                                            className="absolute inset-y-0 z-[5]"
                                            style={{ left: `${leftOffset}px` }}
                                          >
                                            <TimeSlotCard
                                              session={session}
                                              zoomLevel={zoomLevel}
                                              pixelsPerMinute={pixelsPerMinute}
                                              width={sessionWidth}
                                              onToggleLock={onToggleLock}
                                              onEdit={openEditModal}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </div>
                      );
                    })}

                    {/* Empty state */}
                    {displayDepartments.length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-400">
                        <ZapIcon className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm font-bold">No timetable data</p>
                        <p className="text-xs mt-1">Generate a schedule or add rooms and sessions</p>
                        <button
                          onClick={() => data?.refreshMasterMap?.()}
                          className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Refresh
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </DndContext>
            </div>

            {/* ── Zoom controls ──────────────────────────────────────── */}
            <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-2 shadow-lg z-40">
              <button
                onClick={() => onZoomChange(Math.max(0.5, zoomLevel - 0.1))}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min="0.5" max="2" step="0.1"
                value={zoomLevel}
                onChange={e => onZoomChange(parseFloat(e.target.value))}
                className="w-28 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-500"
              />
              <button
                onClick={() => onZoomChange(Math.min(2, zoomLevel + 0.1))}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold text-slate-400 w-8 text-right">
                {Math.round(zoomLevel * 100)}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Session Modal ─────────────────────────────────────────── */}
      <AddSessionModal
        isOpen={addModal.open}
        onClose={closeAddModal}
        onSuccess={() => {
          toast.show?.('Session added successfully', 'success');
          data?.refreshMasterMap?.();
        }}
        prefillRoomId={addModal.roomId}
        prefillRoomName={addModal.roomName}
        prefillSlotLabel={addModal.slotLabel}
        prefillStartTime={addModal.startTime}
        allSessions={classes}
        editSession={addModal.editingSession}
        selectedDay={selectedDay}
      />
    </div>
  );
};

export default TimetableGrid;
