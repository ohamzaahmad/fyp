import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { User, MapPin, Calendar, Clock, BookOpen, ChevronRight, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { getTeacherSchedule } from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';
import Popover from '../ui/Popover.tsx';
import { Button } from '../ui/Button.tsx';

export const MySchedule: React.FC = () => {
  const { teachers = [], sessions = [] } = useData();
  const [selectedTeacherId, setSelectedTeacherId] = useState<any>(null);
  const [fetchedSessions, setFetchedSessions] = useState<any[] | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!selectedTeacherId && teachers && teachers.length > 0) {
      setSelectedTeacherId(teachers[0].id);
    }
  }, [teachers, selectedTeacherId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!selectedTeacherId) return setFetchedSessions(null);
      try {
        // Derive numeric pk if possible
        let pk: number | undefined;
        if (typeof selectedTeacherId === 'number') pk = selectedTeacherId;
        else if (typeof selectedTeacherId === 'string') {
          const m = selectedTeacherId.match(/(\d+)/);
          if (m) pk = parseInt(m[1], 10);
        }
        if (pk === undefined) return;
        const data = await getTeacherSchedule(pk);
        if (!mounted) return;
        setFetchedSessions((data && data.entries) ? data.entries.map((e: any) => ({
          id: e.id,
          subjectCode: e.subjectCode,
          batchId: e.batchId,
          roomId: e.roomId,
          startTime: e.startTime,
          durationMinutes: e.durationMinutes,
        })) : []);
        try { if (data && data.entries && data.entries.length > 0) toast.show('Schedule loaded', 'success'); } catch(_) {}
      } catch (e) {
        console.warn('MySchedule: failed to load schedule', e);
        setFetchedSessions(null);
        try { toast.show('Failed to load schedule', 'error'); } catch(_){}
      }
    };
    load();
    return () => { mounted = false; };
  }, [selectedTeacherId]);

  const selectedTeacher = teachers.find(f => f.id === selectedTeacherId) || null;
  const teacherSessions = (fetchedSessions && fetchedSessions.length > 0)
    ? fetchedSessions
    : sessions.filter(c => (c.teacherId || c.facultyId) === selectedTeacherId);

  return (
    <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden">
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
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">{selectedTeacher?.name}</h1>
              <p className="text-slate-500 font-medium">{selectedTeacher?.department} • Senior Lecturer</p>
            </div>
          </div>
          <div className="flex gap-8">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Weekly Load</p>
              <p className="text-2xl font-black text-slate-900">18 <span className="text-sm font-bold text-slate-400">/ 20 hrs</span></p>
            </div>
            <div className="text-right border-l border-slate-100 pl-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Students Reached</p>
              <p className="text-2xl font-black text-slate-900">452</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-6">
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
              <Calendar className="w-5 h-5 text-emerald-500" />
              Upcoming Sessions
            </h2>
            
            <div className="space-y-4">
              {teacherSessions.map(session => (
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
                  
                  <h3 className="text-xl font-black text-slate-800 mb-6 leading-tight">Advanced Data Structures &amp; Implementation</h3>
                  
                  <div className="grid grid-cols-3 gap-6">
                    <div className="flex items-center gap-3 text-slate-500 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                       <Clock className="w-4 h-4 text-emerald-500" />
                       <div>
                         <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Time</p>
                         <p className="text-xs font-bold text-slate-700">{session.startTime}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                       <MapPin className="w-4 h-4 text-emerald-500" />
                       <div>
                         <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Room</p>
                         <p className="text-xs font-bold text-slate-700">{(session.roomId || '').toUpperCase()}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                       <BookOpen className="w-4 h-4 text-emerald-500" />
                       <div>
                         <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Resources</p>
                         <p className="text-xs font-bold text-slate-700">Digital Pack</p>
                       </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6">Teachers</h2>
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                    {(teachers || []).map(f => (
                  <button 
                    key={f.id}
                    onClick={() => setSelectedTeacherId(f.id)}
                    className={cn(
                      "w-full p-4 flex items-center gap-4 transition-colors border-b last:border-b-0",
                      selectedTeacherId === f.id ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-black",
                      selectedTeacherId === f.id ? "bg-emerald-500 text-slate-900" : "bg-slate-100 text-slate-500"
                    )}>
                      {f.name.charAt(0)}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{f.name}</p>
                      <p className={cn("text-[10px] font-medium uppercase truncate", selectedTeacherId === f.id ? "text-slate-400" : "text-slate-400")}>{f.department}</p>
                    </div>
                    <ChevronRight className={cn("w-4 h-4", selectedTeacherId === f.id ? "text-emerald-500" : "text-slate-300")} />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 text-emerald-400 p-8 rounded-3xl relative overflow-hidden shadow-2xl shadow-slate-900/40">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <User className="w-32 h-32 text-white" />
              </div>
              <h3 className="text-white text-xl font-black mb-2 relative z-10">Support</h3>
              <p className="text-emerald-400/80 text-sm font-medium mb-6 relative z-10 leading-relaxed">Need to request a swap or update your priority? Open a coordinator ticket.</p>
              <Popover trigger={<Button className="w-full bg-emerald-500 text-slate-900 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-400 transition-all relative z-10">Open Support</Button>}>
                <div className="space-y-3">
                 <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-50">Open Ticket</button>
                 <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-50">Contact Coordinator</button>
                 <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-50">View Docs</button>
                </div>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
