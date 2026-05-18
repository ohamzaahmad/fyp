import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { User, MapPin, Calendar, Clock, BookOpen, ChevronRight, TrendingUp, Download, Send, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { getTeacherSchedule, downloadTeacherSchedule, fetchAdjustmentRequests, createAdjustmentRequest, updateAdjustmentRequest } from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';
import Popover from '../ui/Popover.tsx';
import { Button } from '../ui/Button.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const normalizeNumericId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/(\d+)/);
  if (!match) return null;
  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toMinutes = (time: string | undefined | null): number => {
  if (!time) return 0;
  const [h = '0', m = '0'] = time.split(':');
  const hh = parseInt(h, 10);
  const mm = parseInt(m, 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
};

const toTimeString = (mins: number): string => {
  const safe = Math.max(0, mins);
  const hh = Math.floor(safe / 60).toString().padStart(2, '0');
  const mm = (safe % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
};

const formatDuration = (mins: number) => {
  const safe = Math.max(0, Math.floor(mins));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0 && m === 0) return '0h';
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const normalizeSession = (raw: any) => ({
  id: String(raw?.id ?? `${raw?.day_of_week || raw?.dayOfWeek || 'Mon'}-${raw?.startTime || raw?.start_time || '00:00'}`),
  day_of_week: raw?.day_of_week || raw?.dayOfWeek || 'Mon',
  startTime: raw?.startTime || raw?.start_time || '00:00',
  durationMinutes: Number(raw?.durationMinutes ?? raw?.duration_minutes ?? 0) || 0,
  subjectCode: raw?.subjectCode || raw?.subject_code || '',
  subjectName: raw?.subjectName || raw?.subject_name || '',
  batchId: raw?.batchId || raw?.batch || raw?.batch_name || '',
  roomId: raw?.roomId || raw?.room_id || raw?.room || '',
  roomName: raw?.roomName || raw?.room_name || '',
  teacherId: raw?.teacherId || raw?.teacher_id || raw?.facultyId || raw?.faculty_id || '',
  facultyId: raw?.facultyId || raw?.faculty_id || raw?.teacherId || raw?.teacher_id || '',
});

export const MySchedule: React.FC = () => {
  const data = useData();
  const { user } = useAuth();
  const { teachers = [], sessions = [], rooms = [] } = data;
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [fetchedSessions, setFetchedSessions] = useState<any[] | null>(null);
  const [loadingTeacherSchedule, setLoadingTeacherSchedule] = useState(false);
  const [downloadingSchedule, setDownloadingSchedule] = useState(false);
  const [adjustmentRequests, setAdjustmentRequests] = useState<any[]>([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [reviewLoadingId, setReviewLoadingId] = useState<string | number | null>(null);
  const [requestEntryId, setRequestEntryId] = useState<string>('');
  const [requestReason, setRequestReason] = useState('');
  const [requestDay, setRequestDay] = useState(DAY_NAMES[new Date().getDay()] || 'Mon');
  const [requestTime, setRequestTime] = useState('');
  const [selectedDay, setSelectedDay] = useState(DAY_NAMES[new Date().getDay()] || 'Mon');
  const DAYS = data?.systemSettings?.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const toast = useToast();
  const isTeacher = user?.role === 'TEACHER';
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (selectedTeacherId) return;
    if (!teachers || teachers.length === 0) return;

    if (isTeacher) {
      const mine = teachers.find((t: any) => {
        const teacherName = String(t?.name || '').trim().toLowerCase();
        const userName = String(user?.name || '').trim().toLowerCase();
        const teacherEmail = String(t?.email || '').trim().toLowerCase();
        const userEmail = String(user?.email || '').trim().toLowerCase();
        return (teacherName && teacherName === userName) || (teacherEmail && teacherEmail === userEmail);
      });
      if (mine?.id) {
        setSelectedTeacherId(normalizeNumericId(mine.id));
        return;
      }
      setSelectedTeacherId(null);
      return;
    }

    setSelectedTeacherId(normalizeNumericId(teachers[0].id));
  }, [teachers, selectedTeacherId, user, isTeacher]);

  useEffect(() => {
    if (DAYS.length === 0) return;
    if (!DAYS.includes(selectedDay)) {
      const today = DAY_NAMES[new Date().getDay()] || 'Mon';
      setSelectedDay(DAYS.includes(today) ? today : DAYS[0]);
    }
  }, [DAYS, selectedDay]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!selectedTeacherId) {
        setFetchedSessions(null);
        return;
      }
      try {
        setLoadingTeacherSchedule(true);
        const result = await getTeacherSchedule(selectedTeacherId);
        if (!mounted) return;
        const entries = Array.isArray(result?.entries) ? result.entries : [];
        setFetchedSessions(entries.map(normalizeSession));
      } catch (e) {
        console.warn('MySchedule: failed to load schedule', e);
        if (mounted) {
          try { toast.show('Failed to load teacher schedule. Showing local data.', 'error'); } catch (_) {}
        }
        setFetchedSessions(null);
      } finally {
        if (mounted) setLoadingTeacherSchedule(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [selectedTeacherId, toast]);

  useEffect(() => {
    let mounted = true;
    const loadRequests = async () => {
      if (!user || (!isTeacher && !isAdmin)) {
        setAdjustmentRequests([]);
        return;
      }
      try {
        const result = await fetchAdjustmentRequests();
        if (mounted) {
          setAdjustmentRequests(Array.isArray(result) ? result : []);
        }
      } catch (e) {
        if (mounted) {
          console.warn('MySchedule: failed to load adjustment requests', e);
        }
      }
    };
    loadRequests();
    return () => { mounted = false; };
  }, [user, isTeacher, isAdmin]);

  const roomNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    (rooms || []).forEach((r: any) => {
      const rawId = String(r?.id ?? '');
      if (!rawId) return;
      map[rawId] = r?.name || rawId;
      map[`room-${rawId}`] = r?.name || rawId;
    });
    return map;
  }, [rooms]);

  const selectedTeacher =
    teachers.find((f: any) => normalizeNumericId(f.id) === selectedTeacherId) ||
    null;
  
  const teacherSessions = React.useMemo(() => {
    const base = (fetchedSessions && fetchedSessions.length > 0)
      ? fetchedSessions
      : (sessions || []).map(normalizeSession).filter((c: any) => {
          const teacherPk = normalizeNumericId(c.teacherId) ?? normalizeNumericId(c.facultyId);
          return teacherPk === selectedTeacherId;
        });
    
    return base
      .filter((s: any) => s.day_of_week === selectedDay)
      .sort((a: any, b: any) => {
         const t1 = toMinutes(a.startTime);
         const t2 = toMinutes(b.startTime);
         return t1 - t2;
      });
  }, [fetchedSessions, sessions, selectedTeacherId, selectedDay]);

  const totalMinutesForDay = React.useMemo(
    () => teacherSessions.reduce((acc: number, s: any) => acc + (s.durationMinutes || 0), 0),
    [teacherSessions]
  );

  const selectedRequestEntry = React.useMemo(
    () => teacherSessions.find((s: any) => String(s.id) === String(requestEntryId)) || null,
    [teacherSessions, requestEntryId]
  );

  const handleDownloadWeekSchedule = async () => {
    if (!selectedTeacherId) return;
    setDownloadingSchedule(true);
    try {
      const blob = await downloadTeacherSchedule(selectedTeacherId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${selectedTeacher?.name || 'teacher'}-week-schedule.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      try { toast.show('Teacher schedule download started', 'success'); } catch (_) {}
    } catch (e: any) {
      try { toast.show(`Download failed: ${e?.message || String(e)}`, 'error'); } catch (_) {}
    } finally {
      setDownloadingSchedule(false);
    }
  };

  const handleSubmitAdjustmentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestReason.trim()) {
      try { toast.show('Please add a reason for the adjustment request', 'error'); } catch (_) {}
      return;
    }
    setRequestLoading(true);
    try {
      await createAdjustmentRequest({
        related_entry: selectedRequestEntry ? normalizeNumericId(selectedRequestEntry.id) : null,
        requested_day: requestDay,
        requested_time: requestTime || null,
        reason: requestReason.trim(),
      });
      setRequestReason('');
      setRequestTime('');
      setRequestEntryId('');
      try { toast.show('Adjustment request sent to admin', 'success'); } catch (_) {}
      const result = await fetchAdjustmentRequests();
      setAdjustmentRequests(Array.isArray(result) ? result : []);
    } catch (e: any) {
      try { toast.show(`Request failed: ${e?.message || String(e)}`, 'error'); } catch (_) {}
    } finally {
      setRequestLoading(false);
    }
  };

  const handleReviewRequest = async (id: string | number, status: 'APPROVED' | 'REJECTED') => {
    setReviewLoadingId(id);
    try {
      await updateAdjustmentRequest(id, { status });
      const result = await fetchAdjustmentRequests();
      setAdjustmentRequests(Array.isArray(result) ? result : []);
      try { toast.show(`Request ${status.toLowerCase()}`, 'success'); } catch (_) {}
    } catch (e: any) {
      try { toast.show(`Review failed: ${e?.message || String(e)}`, 'error'); } catch (_) {}
    } finally {
      setReviewLoadingId(null);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden" data-tour="teacher-schedule-page">
      <div className="p-8 border-b border-slate-200 bg-white shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-slate-900 flex items-center justify-center text-3xl font-black text-emerald-500 shadow-2xl">
              {selectedTeacher?.name ? selectedTeacher.name.charAt(0) : '?'}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-widest">Active</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {selectedTeacherId ? String(selectedTeacherId).toUpperCase() : 'N/A'}</span>
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">{selectedTeacher?.name || 'Select a Teacher'}</h1>
              <p className="text-slate-500 font-medium">{isTeacher ? 'Your weekly timetable and adjustment requests' : `Department #${selectedTeacher?.department || 'N/A'} • Senior Lecturer`}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <button
              onClick={handleDownloadWeekSchedule}
              disabled={!selectedTeacherId || downloadingSchedule}
              data-tour="teacher-download-schedule"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {downloadingSchedule ? 'Downloading...' : 'Download Week Schedule'}
            </button>
            {DAYS.map((day: string) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition-all",
                  selectedDay === day 
                    ? "bg-slate-900 text-white shadow-lg" 
                    : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                )}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-6">
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-emerald-500" />
                Sessions for {selectedDay}
              </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                {teacherSessions.length} Classes • {formatDuration(totalMinutesForDay)}
              </span>
            </h2>
            
            <div className="space-y-4">
              {loadingTeacherSchedule && (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-500 font-bold">
                  Loading schedule...
                </div>
              )}

              {!loadingTeacherSchedule && !selectedTeacherId && (
                <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center text-slate-400">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-bold">No teacher selected</p>
                </div>
              )}

              {!loadingTeacherSchedule && selectedTeacherId && teacherSessions.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center text-slate-400">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-bold">No sessions scheduled for {selectedDay}</p>
                </div>
              ) : teacherSessions.map(session => (
                <div key={session.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all group cursor-pointer border-l-8 border-l-emerald-500">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                       <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-black rounded-full uppercase">{session.subjectCode}</span>
                       <span className="text-sm font-bold text-slate-900">{session.batchId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600">
                       <TrendingUp className="w-4 h-4" />
                       <span className="text-[10px] font-black uppercase">On Time</span>
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-black text-slate-800 mb-6 leading-tight">{session.subjectName || session.subjectCode || 'Untitled Course'}</h3>
                  
                  <div className="grid grid-cols-3 gap-6">
                    <div className="flex items-center gap-3 text-slate-500 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                       <Clock className="w-4 h-4 text-emerald-500" />
                       <div>
                         <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Time</p>
                         <p className="text-xs font-bold text-slate-700">{session.startTime} - {toTimeString(toMinutes(session.startTime) + (session.durationMinutes || 0))}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                       <MapPin className="w-4 h-4 text-emerald-500" />
                       <div>
                         <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Room</p>
                         <p className="text-xs font-bold text-slate-700">{session.roomName || roomNameById[String(session.roomId)] || String(session.roomId || '').toUpperCase() || 'TBA'}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                       <BookOpen className="w-4 h-4 text-emerald-500" />
                       <div>
                         <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Resources</p>
                         <p className="text-xs font-bold text-slate-700">{session.durationMinutes || 0} mins</p>
                       </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {isTeacher && (
              <form onSubmit={handleSubmitAdjustmentRequest} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4" data-tour="teacher-adjustment-form">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Request Adjustment</h3>
                    <p className="text-xs text-slate-500 mt-1">Send a schedule change request to admin for one of your classes.</p>
                  </div>
                  {selectedRequestEntry && (
                    <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                      {selectedRequestEntry.subjectCode} • {selectedRequestEntry.day_of_week}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <select value={requestEntryId} onChange={(e) => setRequestEntryId(e.target.value)} className="col-span-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                    <option value="">Select a class/session</option>
                    {teacherSessions.map((session: any) => (
                      <option key={session.id} value={session.id}>
                        {session.subjectCode} • {session.day_of_week} • {session.startTime}
                      </option>
                    ))}
                  </select>
                  <select value={requestDay} onChange={(e) => setRequestDay(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                    {DAYS.map((day: string) => <option key={day} value={day}>{day}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <input value={requestTime} onChange={(e) => setRequestTime(e.target.value)} type="time" className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
                  <textarea value={requestReason} onChange={(e) => setRequestReason(e.target.value)} placeholder="Explain the adjustment you need" className="col-span-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm min-h-[92px]" />
                </div>

                <div className="flex justify-end">
                  <button type="submit" disabled={requestLoading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-900 text-xs font-black uppercase tracking-widest disabled:opacity-60">
                    <Send className="w-4 h-4" />
                    {requestLoading ? 'Sending...' : 'Send Request'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="space-y-8">
            {!isTeacher && (
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6">Teachers</h2>
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                      {(teachers || []).map(f => (
                    <button 
                      key={f.id}
                      onClick={() => setSelectedTeacherId(normalizeNumericId(f.id))}
                      className={cn(
                        "w-full p-4 flex items-center gap-4 transition-colors border-b last:border-b-0",
                        selectedTeacherId === normalizeNumericId(f.id) ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-black",
                        selectedTeacherId === normalizeNumericId(f.id) ? "bg-emerald-500 text-slate-900" : "bg-slate-100 text-slate-500"
                      )}>
                        {f.name.charAt(0)}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{f.name}</p>
                        <p className={cn("text-[10px] font-medium uppercase truncate", selectedTeacherId === normalizeNumericId(f.id) ? "text-slate-400" : "text-slate-400")}>Department #{f.department}</p>
                      </div>
                      <ChevronRight className={cn("w-4 h-4", selectedTeacherId === normalizeNumericId(f.id) ? "text-emerald-500" : "text-slate-300")} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Adjustment Requests</h2>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{adjustmentRequests.length} total</span>
                </div>
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {adjustmentRequests.length === 0 ? (
                    <div className="text-sm text-slate-500 bg-slate-50 rounded-2xl p-4">No adjustment requests yet.</div>
                  ) : adjustmentRequests.map((req: any) => (
                    <div key={req.id} className={cn('rounded-2xl border p-4', req.status === 'PENDING' ? 'border-amber-200 bg-amber-50/60' : req.status === 'APPROVED' ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60')}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{req.teacher_name}</p>
                          <p className="text-[11px] text-slate-500">{req.course_code || req.course_name || 'Class'}{req.batch_name ? ` • ${req.batch_name}` : ''}</p>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">{req.status}</span>
                      </div>
                      <p className="text-xs text-slate-600 mb-2">{req.reason}</p>
                      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 uppercase tracking-widest">
                        <span>{req.requested_day || 'Any day'}{req.requested_time ? ` • ${req.requested_time}` : ''}</span>
                        {req.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button type="button" disabled={reviewLoadingId === req.id} onClick={() => handleReviewRequest(req.id, 'APPROVED')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-black disabled:opacity-60">
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </button>
                            <button type="button" disabled={reviewLoadingId === req.id} onClick={() => handleReviewRequest(req.id, 'REJECTED')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500 text-white font-black disabled:opacity-60">
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isTeacher ? (
              <div className="bg-slate-900 text-emerald-400 p-8 rounded-3xl relative overflow-hidden shadow-2xl shadow-slate-900/40" data-tour="teacher-adjustment-requests">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <User className="w-32 h-32 text-white" />
                </div>
                <h3 className="text-white text-xl font-black mb-2 relative z-10">Teacher Tools</h3>
                <p className="text-emerald-400/80 text-sm font-medium mb-6 relative z-10 leading-relaxed">Download your weekly schedule, submit an adjustment request, and track your timetable only.</p>
                <div className="space-y-2 relative z-10 text-sm text-emerald-50/90">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Week schedule download</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Adjustment requests to admin</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Daily class overview</div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 text-emerald-400 p-8 rounded-3xl relative overflow-hidden shadow-2xl shadow-slate-900/40">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <User className="w-32 h-32 text-white" />
                </div>
                <h3 className="text-white text-xl font-black mb-2 relative z-10">Review Queue</h3>
                <p className="text-emerald-400/80 text-sm font-medium mb-6 relative z-10 leading-relaxed">Admin can approve or reject teacher requests directly from this panel.</p>
                <div className="space-y-2 relative z-10 text-sm text-emerald-50/90">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Pending request review</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Teacher schedule access</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Week exports for any faculty</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
