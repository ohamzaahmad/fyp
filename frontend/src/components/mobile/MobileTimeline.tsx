import React from 'react';
import { ClassSession, Teacher } from '../../types.ts';
import { useData } from '../../context/DataContext.tsx';
import { cn } from '../../lib/utils.ts';
import { Clock, MapPin, User, BookOpen } from 'lucide-react';
import { timeToMinutes } from '../../services/timetableLogic.ts';

interface MobileTimelineProps {
  classes: ClassSession[];
}

export const MobileTimeline: React.FC<MobileTimelineProps> = ({ classes }) => {
  const data = useData();
  const [selectedDay, setSelectedDay] = React.useState(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()] || 'Mon');
  const DAYS = data?.systemSettings?.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const filteredClasses = React.useMemo(() => {
    return classes
      .filter(c => c.day_of_week === selectedDay || (c as any).dayOfWeek === selectedDay)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [classes, selectedDay]);

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-0 overflow-y-auto pb-20">
      <div className="p-4 border-b border-white bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">{selectedDay}'s Schedule</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Official UAF Timetable</p>
          </div>
          <div className="bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded">LIVE</div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0",
                selectedDay === day 
                  ? "bg-slate-900 text-white shadow-lg scale-105" 
                  : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"
              )}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {filteredClasses.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Clock className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">No sessions scheduled for today.</p>
          </div>
        ) : (
          filteredClasses.map((session, idx) => {
            const teacherId = session.teacherId || session.facultyId;
            const teacher = data?.teachers.find(t => String(t.id) === String(teacherId));
            
            return (
              <div 
                key={session.id} 
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4 items-stretch relative overflow-hidden"
              >
                {/* Time Rail */}
                <div className="flex flex-col items-center justify-between py-1 border-r border-slate-100 pr-4 min-w-[60px]">
                  <span className="text-xs font-black text-slate-900">{session.startTime}</span>
                  <div className="w-[2px] flex-1 bg-slate-100 my-2 rounded-full" />
                  <span className="text-[10px] font-bold text-slate-400">
                    {Math.round(session.durationMinutes / 60)}h {session.durationMinutes % 60}m
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 py-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded uppercase tracking-tighter">
                      {session.subjectCode}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 tracking-tight">{session.batchId}</span>
                  </div>
                  
                  <h3 className="text-sm font-black text-slate-900 mb-3 leading-tight">Advanced Algorithms & Data Structures</h3>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500">
                      <User className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-bold">{teacher?.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-bold">Room {session.roomId.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="absolute top-0 right-0 w-1 px-4 h-full bg-emerald-500 opacity-10" />
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button (Information) */}
      <div className="fixed bottom-6 right-6">
        <button className="w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center border-4 border-white">
          <BookOpen className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
