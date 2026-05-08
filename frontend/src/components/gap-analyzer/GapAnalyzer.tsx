import React from 'react';
import { INITIAL_CLASSES, FACULTY } from '../../constants.ts';
import { cn } from '../../lib/utils.ts';
import { Clock, Scissors, Zap, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { calculateGaps, timeToMinutes } from '../../services/timetableLogic.ts';

export const GapAnalyzer: React.FC = () => {
  const batchId = 'B2023-A';
  const batchClasses = INITIAL_CLASSES.filter(c => c.batchId === batchId);
  const START_HOUR = 8;
  const END_HOUR = 18;
  const totalHours = END_HOUR - START_HOUR;

  const gaps = calculateGaps(batchClasses);
  const totalWasted = gaps.reduce((acc, g) => acc + g.duration, 0);

  return (
    <div className="flex-1 p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Student Diagnostic</span>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gap Analyzer: {batchId}</h1>
          </div>
          <button className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-900/10">
            <Scissors className="w-4 h-4 text-emerald-400" />
            Compress Schedule
          </button>
        </div>

        {/* Timeline Visualization */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden mb-8">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                <Clock className="w-4 h-4" />
                Working Hours (08:00 - 18:00)
              </div>
              <div className="h-4 w-[1px] bg-slate-200" />
              <div className="text-xs font-bold text-slate-900">Total Wasted Time: <span className="text-rose-500">{totalWasted}m</span></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Class</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-rose-200 rounded-sm" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Gap</span>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="relative h-24 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
               {/* Time markers */}
               <div className="absolute inset-0 flex divide-x divide-slate-100 pointer-events-none">
                  {Array.from({ length: totalHours + 1 }).map((_, i) => (
                    <div key={i} className="flex-1 h-full pt-1 pr-1 text-right">
                       <span className="text-[8px] font-mono text-slate-300">{(START_HOUR + i).toString().padStart(2, '0')}:00</span>
                    </div>
                  ))}
               </div>

               {/* Sessions and Gaps */}
               <div className="absolute inset-y-0 left-0 right-0 flex items-center px-2">
                  <div className="relative w-full h-12">
                     {batchClasses.map(session => {
                        const start = timeToMinutes(session.startTime);
                        const left = ((start - START_HOUR * 60) / (totalHours * 60)) * 100;
                        const width = (session.durationMinutes / (totalHours * 60)) * 100;
                        
                        return (
                          <div 
                            key={session.id}
                            className="absolute h-full bg-emerald-500 border border-emerald-600 rounded shadow-md flex items-center justify-center text-[10px] font-black text-white px-2 overflow-hidden"
                            style={{ left: `${left}%`, width: `${width}%` }}
                          >
                            {session.subjectCode}
                          </div>
                        );
                     })}

                     {gaps.map((gap, i) => {
                        const left = ((gap.start - START_HOUR * 60) / (totalHours * 60)) * 100;
                        const width = (gap.duration / (totalHours * 60)) * 100;

                        return (
                          <div 
                            key={i}
                            className={cn(
                              "absolute h-full flex flex-col items-center justify-center border-x-2 border-dashed transition-colors",
                              gap.severity === 'high' ? "bg-rose-100 border-rose-300" : "bg-amber-50 border-amber-200"
                            )}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          >
                            {gap.severity === 'high' && <AlertTriangle className="w-3 h-3 text-rose-500 mb-0.5" />}
                            <span className={cn("text-[8px] font-black uppercase", gap.severity === 'high' ? "text-rose-500" : "text-amber-500")}>Wasted</span>
                          </div>
                        );
                     })}
                  </div>
               </div>
            </div>
            
            <div className="mt-6 flex items-start gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <Zap className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-900 leading-none mb-1">Opportunity Found</p>
                <p className="text-xs text-emerald-700/80 leading-relaxed">By moving <span className="font-bold">CS102</span> to <span className="font-bold underline">12:00 PM</span>, you can reduce total daily gaps by <span className="font-bold">120 minutes</span>. This is compatible with Lab-A capacity constraints.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4">Efficiency Metrics</h3>
            <div className="space-y-4">
              {[
                { label: 'Continuous Blocks', value: '45%', color: 'bg-emerald-500' },
                { label: 'Day Length', value: '8.5h', color: 'bg-amber-500' },
                { label: 'Wasted Slots', value: '3', color: 'bg-rose-500' },
              ].map(metric => (
                <div key={metric.label}>
                  <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase mb-1">
                    <span>{metric.label}</span>
                    <span className="text-slate-900">{metric.value}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full", metric.color)} 
                      style={{ width: metric.value.includes('%') ? metric.value : '70%' }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/10">
            <h3 className="text-sm font-black uppercase tracking-tight mb-4">Export Timetable</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">Generate a student-optimized PDF containing session summaries, faculty contact cards, and room directions.</p>
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-[10px] font-bold uppercase transition-colors">Download PDF</button>
              <button className="bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase transition-colors">Sync iCal</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
