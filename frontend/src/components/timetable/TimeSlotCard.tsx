import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ClassSession, Teacher } from '../../types.ts';
import { useData } from '../../context/DataContext.tsx';
import { cn } from '../../lib/utils.ts';
import { AlertCircle, Layers, Lock, Unlock } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext.tsx';

interface TimeSlotCardProps {
  session: ClassSession;
  zoomLevel: number;
  pixelsPerMinute: number;
  onToggleLock: (id: string) => void;
}

export const TimeSlotCard: React.FC<TimeSlotCardProps> = ({ 
  session, 
  zoomLevel,
  pixelsPerMinute,
  onToggleLock
}) => {
  const { user } = useAuth();
  const data = useData();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
    data: session,
    disabled: session.isLocked || user?.role === 'TEACHER'
  });

  const teacherId = session.teacherId || session.facultyId;
  const teacher = data?.teachers.find(t => String(t.id) === String(teacherId));
  const width = session.durationMinutes * pixelsPerMinute;
  
  const style = {
    transform: CSS.Translate.toString(transform),
    width: `${width}px`,
    zIndex: isDragging ? 100 : 10,
  };

  const isConflict = session.conflicts && session.conflicts.length > 0;
  const criticalConflicts = session.conflicts?.filter(c => c.severity === 'Critical') || [];

  return (
    <div
      id={session.id}
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "absolute top-1 bottom-1 rounded border-l-4 shadow-sm select-none transition-all group/card",
        isDragging ? "shadow-xl ring-2 ring-emerald-500/50 z-[100]" : "hover:shadow-md hover:z-20",
        criticalConflicts.length > 0
          ? "bg-rose-50 border-rose-500 text-rose-700 active:ring-rose-500/30 ring-4 ring-rose-500/5" 
          : isConflict 
            ? "bg-amber-50 border-amber-500 text-amber-900"
            : "bg-emerald-50/50 border-emerald-500 text-slate-700",
        zoomLevel < 0.8 ? "px-1.5 text-[9px]" : "px-2 text-[10px]"
      )}
    >
      <div className="flex flex-col h-full justify-center overflow-hidden">
        <div className="flex items-center justify-between gap-1">
          <span className="font-black truncate leading-tight uppercase tracking-tighter">
            {session.subjectCode}
          </span>
          {isConflict && (
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <div className={cn(
                "w-2.5 h-2.5 rounded-full shrink-0",
                criticalConflicts.length > 0 
                  ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" 
                  : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
              )} />
            </motion.div>
          )}
          {session.isMerged && (
            <div className="p-0.5 bg-indigo-100 rounded text-indigo-600">
               <Layers className="w-2.5 h-2.5 shrink-0" />
            </div>
          )}
          {user?.role === 'ADMIN' && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(session.id);
              }}
              className={cn(
                "p-0.5 rounded transition-all hover:bg-black/5",
                session.isLocked ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"
              )}
            >
              {session.isLocked ? <Lock className="w-2.5 h-2.5 text-emerald-600" /> : <Unlock className="w-2.5 h-2.5 text-slate-300" />}
            </button>
          )}
          {user?.role === 'TEACHER' && session.isLocked && (
            <div className="p-0.5 text-emerald-600">
               <Lock className="w-2.5 h-2.5" />
            </div>
          )}
        </div>
        
        {zoomLevel >= 0.6 && (
          <div className="flex flex-col mt-0.5 leading-none">
            <div className="text-slate-900 truncate text-[9px] font-black uppercase tracking-tight">
              {session.batchId}
            </div>
            <div className="text-slate-500 truncate text-[8px] font-bold uppercase tracking-tight">
              {teacher?.name}
            </div>
          </div>
        )}
      </div>

      {/* Conflict Tooltip */}
      {isConflict && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-900 text-white p-3 rounded-lg text-[10px] shadow-2xl opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none z-[110] border border-slate-800">
          {session.conflicts?.map((conflict, i) => (
            <div key={i} className={cn("mb-2 last:mb-0", i > 0 ? "pt-2 border-t border-slate-800" : "")}>
              <div className={cn(
                "flex items-center gap-2 mb-1 font-bold uppercase tracking-wider",
                conflict.severity === 'Critical' ? "text-rose-400" : "text-amber-400"
              )}>
                <AlertCircle className="w-3 h-3" />
                {conflict.type} {conflict.severity}
              </div>
              <p className="leading-relaxed text-slate-300">
                {conflict.conflictingWithName}
              </p>
            </div>
          ))}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
        </div>
      )}

      {/* Conflict Glow Effect */}
      {session.isConflict && (
        <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none rounded-sm" />
      )}
    </div>
  );
};
