import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ClassSession, Teacher } from '../../types.ts';
import { useData } from '../../context/DataContext.tsx';
import { cn } from '../../lib/utils.ts';
import { AlertTriangle, GitMerge, Lock, Pencil } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext.tsx';

interface TimeSlotCardProps {
  session: ClassSession;
  zoomLevel: number;
  pixelsPerMinute: number;
  width: number;
  onToggleLock: (id: string) => void;
  onEdit?: (session: ClassSession) => void;
}

export const TimeSlotCard: React.FC<TimeSlotCardProps> = ({
  session,
  zoomLevel,
  pixelsPerMinute,
  width,
  onToggleLock,
  onEdit
}) => {
  const { user } = useAuth();
  const data = useData();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
    data: session,
    disabled: session.isLocked
  });

  const teacherId = session.teacherId || session.facultyId;
  const teacher = data?.teachers.find(t => String(t.id) === String(teacherId));

  const style = {
    transform: CSS.Translate.toString(transform),
    width: `${width}px`,
    zIndex: isDragging ? 200 : 10,
  };

  const hoverZIndex = 'hover:z-[100]';

  const criticalConflicts = session.conflicts?.filter(c => c.severity === 'Critical') || [];
  const warningConflicts = session.conflicts?.filter(c => c.severity === 'Warning') || [];
  const isMergeCandidate = warningConflicts.some(c => c.type === 'Room');
  const hasCritical = criticalConflicts.length > 0;
  const hasWarning = warningConflicts.length > 0;
  const hasConflict = hasCritical || hasWarning;

  // Visual state
  const cardStyle = hasCritical
    ? 'bg-rose-50 border-l-4 border-rose-500 text-rose-800 hover:bg-rose-100/80'
    : isMergeCandidate
    ? 'bg-amber-50 border-l-4 border-amber-400 text-amber-800 hover:bg-amber-100/80'
    : session.isMerged
    ? 'bg-indigo-50 border-l-4 border-indigo-500 text-indigo-800 hover:bg-indigo-100/80'
    : 'bg-white border-l-4 border-emerald-500 text-slate-700 hover:bg-slate-50';

  return (
    <div
      id={session.id}
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'absolute inset-y-1 rounded-r-lg shadow-sm select-none transition-shadow duration-150 group/card cursor-grab active:cursor-grabbing',
        cardStyle,
        isDragging && 'shadow-2xl ring-2 ring-slate-900/20 !z-[200] scale-[1.01] rotate-1 opacity-95',
        !isDragging && 'hover:z-[100]',
        session.isLocked && 'cursor-not-allowed opacity-80',
        hasCritical && !isDragging && 'ring-1 ring-rose-300',
        zoomLevel < 0.8 ? 'px-1' : 'px-2'
      )}
    >
      {/* Pulsing left-edge glow for critical conflicts */}
      {hasCritical && (
        <motion.div
          className="absolute left-0 inset-y-0 w-1 rounded-l-sm bg-rose-500"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        />
      )}

      <div className="flex flex-col h-full justify-center overflow-hidden">
        {/* Top row: subject code + badges */}
        <div className="flex items-center gap-1 justify-between">
          <span className={cn(
            'font-black truncate uppercase leading-tight tracking-tighter',
            zoomLevel < 0.8 ? 'text-[9px]' : 'text-[10px]'
          )}>
            {session.subjectCode}
          </span>

          <div className="flex items-center gap-0.5 shrink-0">
            {/* Conflict indicator */}
            {hasCritical && (
              <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
            )}
            {/* Merge badge */}
            {isMergeCandidate && !hasCritical && (
              <div className="w-3.5 h-3.5 bg-amber-100 rounded-sm flex items-center justify-center">
                <GitMerge className="w-2.5 h-2.5 text-amber-600" />
              </div>
            )}
            {session.isMerged && (
              <div className="w-3.5 h-3.5 bg-indigo-100 rounded-sm flex items-center justify-center">
                <GitMerge className="w-2.5 h-2.5 text-indigo-600" />
              </div>
            )}
            {/* Edit button — only for admins */}
            {user?.role === 'ADMIN' && !session.isLocked && (
              <button
                onClick={e => { e.stopPropagation(); onEdit?.(session); }}
                className="p-0.5 rounded hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-all opacity-0 group-hover/card:opacity-100"
                title="Edit session"
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
            )}
            {/* Lock — only admins see the toggle; everyone sees the lock icon if locked */}
            {session.isLocked && user?.role === 'ADMIN' && (
              <button
                onClick={e => { e.stopPropagation(); onToggleLock(session.id); }}
                className="p-0.5 rounded hover:bg-black/5 transition-colors"
                title="Unlock session"
              >
                <Lock className="w-2.5 h-2.5 text-slate-400" />
              </button>
            )}
            {session.isLocked && user?.role !== 'ADMIN' && (
              <Lock className="w-2.5 h-2.5 text-slate-300" />
            )}
          </div>
        </div>

        {/* Sub-info rows */}
        {zoomLevel >= 0.6 && (
          <div className="flex flex-col mt-0.5 leading-none gap-0.5">
            <div className={cn(
              'truncate font-semibold uppercase tracking-tight',
              zoomLevel < 0.8 ? 'text-[8px]' : 'text-[9px]',
              hasCritical ? 'text-rose-600' : isMergeCandidate ? 'text-amber-600' : 'text-slate-500'
            )}>
              {session.batchId}
            </div>
            {zoomLevel >= 0.9 && teacher && (
              <div className="text-[8px] text-slate-400 truncate font-medium italic">
                {teacher.name}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hover tooltip for conflicts */}
      {hasConflict && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 text-white p-3 rounded-xl text-[10px] shadow-2xl opacity-0 group-hover/card:opacity-100 transition-all duration-200 pointer-events-none z-[300] border border-slate-700 origin-bottom scale-95 group-hover/card:scale-100">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
            <span className="font-black uppercase tracking-wider text-slate-200">
              {hasCritical ? `${criticalConflicts.length} Critical Conflict${criticalConflicts.length > 1 ? 's' : ''}` : 'Merge Candidate'}
            </span>
          </div>
          <div className="space-y-1.5">
            {session.conflicts?.map((c, i) => (
              <div key={i} className={cn(
                'flex items-start gap-1.5',
                c.severity === 'Critical' ? 'text-rose-300' : 'text-amber-300'
              )}>
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full mt-1 shrink-0',
                  c.severity === 'Critical' ? 'bg-rose-500' : 'bg-amber-400'
                )} />
                <span className="font-medium leading-relaxed">
                  <span className="font-black">[{c.type}]</span> {c.conflictingWithName}
                </span>
              </div>
            ))}
          </div>
          {isMergeCandidate && !hasCritical && (
            <p className="mt-2 pt-2 border-t border-slate-700 text-[9px] text-amber-400 font-medium">
              Go to Suggestions → Merge to resolve
            </p>
          )}
          {hasCritical && (
            <p className="mt-2 pt-2 border-t border-slate-700 text-[9px] text-rose-400 font-medium">
              Move this session or use AI Suggestions to resolve
            </p>
          )}
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
        </div>
      )}

      {/* Critical conflict pulsing overlay */}
      {hasCritical && (
        <motion.div
          className="absolute inset-0 rounded-r-lg bg-rose-500/8 pointer-events-none"
          animate={{ opacity: [0, 0.15, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      )}
    </div>
  );
};

export default TimeSlotCard;
