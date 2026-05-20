import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, AlertTriangle, CheckCircle2, Loader2, GitMerge } from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { cn } from '../../lib/utils.ts';
import { TIME_SLOTS } from '../../constants.ts';
import { checkConflicts } from '../../services/timetableLogic.ts';
import { ClassSession } from '../../types.ts';
import * as api from '../../services/api.ts';

interface AddSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-fill room and timeslot when clicking an empty cell */
  prefillRoomId?: string;
  prefillRoomName?: string;
  prefillSlotLabel?: string;
  prefillStartTime?: string;
  /** All current sessions for live conflict preview */
  allSessions: ClassSession[];
  /** Optional session to edit instead of creating new */
  editSession?: ClassSession | null;
  onDelete?: (id: string) => void;
  /** The currently selected day from the grid */
  selectedDay?: string;
}

const DURATIONS = [50, 100, 150];

export const AddSessionModal: React.FC<AddSessionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  prefillRoomId,
  prefillRoomName,
  prefillSlotLabel,
  prefillStartTime,
  allSessions,
  editSession,
  onDelete,
  selectedDay = 'Mon'
}) => {
  const data = useData();

  const [assignmentId, setAssignmentId] = useState('');
  const [roomId, setRoomId] = useState(prefillRoomId || '');
  const [startTime, setStartTime] = useState(prefillStartTime || '');
  const [duration, setDuration] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live conflict preview
  const [liveConflicts, setLiveConflicts] = useState<ReturnType<typeof checkConflicts>>([]);
  const [isMergeCandidate, setIsMergeCandidate] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      if (editSession) {
        // Pre-fill from existing session
        // Need to find assignment ID. ClassSession usually has subjectCode/batchId/facultyId.
        // We might need to find the assignment that matches these.
        const assignment = data.assignments.find(a => {
          const c = data.courses.find(x => x.id === a.course);
          const b = data.batches.find(x => x.id === a.batch);
          const t = data.teachers.find(x => x.id === a.teacher);
          const fid = `faculty-${t?.id}`;
          return c?.course_id === editSession.subjectCode && 
                 b?.name === editSession.batchId && 
                 (fid === editSession.facultyId || String(t?.id) === String(editSession.teacherId));
        });
        
        setAssignmentId(assignment ? String(assignment.id) : '');
        const cleanRoomId = String(editSession.roomId || '').replace('room-', '');
        setRoomId(cleanRoomId);
        setStartTime(editSession.startTime || '');
        setDuration(editSession.durationMinutes || 50);
      } else {
        setAssignmentId('');
        const cleanRoomId = String(prefillRoomId || '').replace('room-', '');
        setRoomId(cleanRoomId);
        setStartTime(prefillStartTime || '');
        setDuration(50);
      }
      setError(null);
      setLiveConflicts([]);
      setIsMergeCandidate(false);
    }
  }, [isOpen, editSession, prefillRoomId, prefillStartTime, data.assignments, data.courses, data.batches, data.teachers]);

  // Prefill room if changed
  useEffect(() => {
    if (prefillRoomId) setRoomId(String(prefillRoomId).replace('room-', ''));
  }, [prefillRoomId]);

  useEffect(() => {
    if (prefillStartTime) setStartTime(prefillStartTime);
  }, [prefillStartTime]);

  // Fetch assignments for dropdown
  useEffect(() => {
    if (isOpen && data.assignments.length === 0) {
      data.fetchAssignments();
    }
    if (isOpen && data.courses.length === 0) data.fetchCourses();
    if (isOpen && data.batches.length === 0) data.fetchBatches();
    if (isOpen && data.teachers.length === 0) data.fetchTeachers();
    if (isOpen && data.rooms.length === 0) data.fetchRooms();
  }, [isOpen]);

  // Live conflict check as user fills form
  const checkLiveConflicts = useCallback(() => {
    if (!assignmentId || !startTime || !roomId) {
      setLiveConflicts([]);
      setIsMergeCandidate(false);
      return;
    }

    const assignment = data.assignments.find(a => String(a.id) === assignmentId);
    if (!assignment) return;

    const course = data.courses.find(c => c.id === assignment.course);
    const batch = data.batches.find(b => b.id === assignment.batch);
    const teacher = data.teachers.find(t => t.id === assignment.teacher);

    const preview: ClassSession = {
      id: '__preview__',
      subjectCode: course?.course_id || '',
      batchId: batch?.name || '',
      teacherId: String(teacher?.id || ''),
      facultyId: `faculty-${teacher?.id || ''}`,
      roomId,
      startTime,
      durationMinutes: duration,
      day_of_week: editSession?.day_of_week || (editSession as any)?.dayOfWeek || selectedDay,
    };

    const otherSessions = allSessions.filter(s => s.id !== editSession?.id);
    const conflicts = checkConflicts(preview, otherSessions, data.teachers);
    setLiveConflicts(conflicts);
    const hasMerge = conflicts.some(c => c.severity === 'Warning' && c.type === 'Room');
    setIsMergeCandidate(hasMerge);
  }, [assignmentId, startTime, roomId, duration, allSessions, data.assignments, data.courses, data.batches, data.teachers, editSession]);

  useEffect(() => {
    checkLiveConflicts();
  }, [checkLiveConflicts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentId || !startTime || !roomId) {
      setError('Please fill in all required fields.');
      return;
    }
    const criticalConflicts = liveConflicts.filter(c => c.severity === 'Critical');
    if (criticalConflicts.length > 0) {
      setError('Cannot add session: there are critical conflicts. Resolve them first or adjust the slot.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const roomPk = roomId.startsWith('room-') ? parseInt(roomId.split('-')[1]) : parseInt(roomId);
      const payload = {
        assignment: parseInt(assignmentId),
        room: roomPk,
        day_of_week: editSession?.day_of_week || (editSession as any)?.dayOfWeek || selectedDay,
        start_time: startTime,
        duration_minutes: duration,
      };

      if (editSession) {
        await api.updateEntry(editSession.id, payload);
      } else {
        await api.createEntry(payload);
      }

      await data.refreshMasterMap();
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || `Failed to ${editSession ? 'update' : 'create'} session.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editSession) return;
    if (!window.confirm('Are you sure you want to delete this session?')) return;
    
    setIsDeleting(true);
    try {
      await api.deleteEntry(editSession.id);
      await data.refreshMasterMap();
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete session.');
    } finally {
      setIsDeleting(false);
    }
  };

  const criticalConflicts = liveConflicts.filter(c => c.severity === 'Critical');
  const warningConflicts = liveConflicts.filter(c => c.severity === 'Warning');
  const hasIssues = liveConflicts.length > 0;

  const selectedAssignment = data.assignments.find(a => String(a.id) === assignmentId);
  const selectedCourse = selectedAssignment ? data.courses.find(c => c.id === selectedAssignment.course) : null;
  const selectedBatch = selectedAssignment ? data.batches.find(b => b.id === selectedAssignment.batch) : null;
  const selectedTeacher = selectedAssignment ? data.teachers.find(t => t.id === selectedAssignment.teacher) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
          >
            {/* Header */}
            <div data-tour="modal-header" className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Timetable</p>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {editSession ? 'Edit Session' : 'Add Class Session'}
                </h2>
                {prefillRoomName && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {prefillRoomName}
                    {prefillSlotLabel && <span className="ml-2 text-emerald-600 font-bold">@ {prefillSlotLabel}</span>}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                data-tour="modal-close"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Assignment selector */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  Course Assignment <span className="text-rose-500">*</span>
                </label>
                <select
                  value={assignmentId}
                  onChange={e => setAssignmentId(e.target.value)}
                  data-tour="modal-assignment"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none appearance-none cursor-pointer"
                  required
                >
                  <option value="">— Select assignment —</option>
                  {data.assignments.map(a => {
                    const c = data.courses.find(x => x.id === a.course);
                    const b = data.batches.find(x => x.id === a.batch);
                    const t = data.teachers.find(x => x.id === a.teacher);
                    return (
                      <option key={a.id} value={a.id}>
                        {c?.course_id || '?'} · {b?.name || '?'} · {t?.name || '?'}
                      </option>
                    );
                  })}
                </select>

                {/* Assignment preview */}
                {selectedAssignment && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Course', val: selectedCourse?.course_id },
                      { label: 'Batch', val: selectedBatch?.name },
                      { label: 'Teacher', val: selectedTeacher?.name },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-slate-50 rounded-lg px-2 py-1.5 text-center">
                        <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">{label}</p>
                        <p className="text-[10px] text-slate-700 font-black truncate">{val || '—'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Room selector */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  Room <span className="text-rose-500">*</span>
                </label>
                <select
                  value={String(roomId)}
                  onChange={e => setRoomId(e.target.value)}
                  data-tour="modal-room"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none appearance-none cursor-pointer"
                  required
                >
                  <option value="">— Select room —</option>
                  {data.rooms.map(r => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name} (Cap: {r.capacity})
                    </option>
                  ))}
                </select>
              </div>

              {/* Time slot selector */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  Time Slot <span className="text-rose-500">*</span>
                </label>
                <div data-tour="modal-timeslots" className="grid grid-cols-3 gap-1.5">
                  {TIME_SLOTS.filter(s => s !== 'Break').map((slot, idx) => {
                    const parts = slot.split('-').map(p => p.trim());
                    const parse = (t: string) => {
                      const [h, m] = t.split(':').map(s => s.trim());
                      let hh = Number(h);
                      if (hh >= 1 && hh <= 7) hh += 12;
                      return `${String(hh).padStart(2, '0')}:${m || '00'}`;
                    };
                    const slotStartTime = parse(parts[0]);
                    const isSelected = startTime === slotStartTime;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setStartTime(slotStartTime)}
                        className={cn(
                          'rounded-lg px-2 py-2 text-[9px] font-bold transition-all border',
                          isSelected
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'
                        )}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  Duration
                </label>
                <div data-tour="modal-duration" className="flex gap-2">
                  {DURATIONS.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-xs font-bold border transition-all',
                        duration === d
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      )}
                    >
                      {d} min ({d / 50} slot{d > 50 ? 's' : ''})
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Conflict Preview */}
              <AnimatePresence>
                {hasIssues && (
                    <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className={cn(
                      'rounded-xl p-3 border',
                      criticalConflicts.length > 0
                        ? 'bg-rose-50 border-rose-200'
                        : 'bg-amber-50 border-amber-200'
                    )}>
                      {/* Live conflict preview */}
                      <div data-tour="modal-conflict-preview">
                      <div className="flex items-center gap-2 mb-2">
                        {isMergeCandidate && criticalConflicts.length === 0 ? (
                          <>
                            <GitMerge className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
                              Merge Candidate
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                            <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider">
                              {criticalConflicts.length} Conflict{criticalConflicts.length !== 1 ? 's' : ''} Detected
                            </span>
                          </>
                        )}
                      </div>
                      <div className="space-y-1">
                        {liveConflicts.map((c, i) => (
                          <div key={i} className={cn(
                            'text-[10px] font-medium flex items-start gap-1.5',
                            c.severity === 'Critical' ? 'text-rose-700' : 'text-amber-700'
                          )}>
                            <span className={cn(
                              'inline-block w-1.5 h-1.5 rounded-full mt-1 shrink-0',
                              c.severity === 'Critical' ? 'bg-rose-500' : 'bg-amber-500'
                            )} />
                            <span>[{c.type}] {c.conflictingWithName}</span>
                          </div>
                        ))}
                      </div>
                      {isMergeCandidate && criticalConflicts.length === 0 && (
                        <p className="mt-2 text-[9px] text-amber-600 font-medium">
                          Sessions with same teacher & course can be merged from the Suggestions page.
                        </p>
                      )}
                    </div>
                    </div>
                  </motion.div>
                )}
                {!hasIssues && assignmentId && startTime && roomId && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-700">No conflicts — safe to schedule</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error */}
              {error && (
                <p className="text-xs text-rose-600 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                {editSession && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    data-tour="modal-delete"
                    disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-xl border border-rose-200 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || criticalConflicts.length > 0}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all',
                    criticalConflicts.length > 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm hover:shadow-emerald-500/30 active:scale-95'
                  )}
                  data-tour="modal-submit"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {editSession ? 'Updating...' : 'Adding...'}</>
                  ) : (
                    <>{editSession ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {editSession ? 'Update Session' : 'Add Session'}</>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddSessionModal;
