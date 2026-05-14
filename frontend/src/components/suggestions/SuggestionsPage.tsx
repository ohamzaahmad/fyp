import React, { useState } from 'react';
import { Sparkles, Users, Check, AlertTriangle, Clock, CalendarX, GraduationCap } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { useToast } from '../ui/Toast.tsx';
import { BatchAnalysis } from './BatchAnalysis.tsx';

// Tabs available on the Suggestions page
type SuggestionsTab = 'suggestions' | 'batch-analysis';

export const SuggestionsPage: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<SuggestionsTab>('suggestions');

  const handleApproveMerge = (id: number) => {
    toast.show(`Merge suggestion #${id} approved. Timetable updated.`, 'success');
  };

  const handleResolveConflict = (id: number) => {
    toast.show(`Conflict #${id} marked as resolved.`, 'success');
  };

  // Static sample data — replace with API calls when backend endpoint is ready
  const mergeSuggestions = [
    { id: 1, subject: 'CS-501 (Fundamental Sciences)', teacher: 'Dr. Sarah Connor', sections: ['B2023-A', 'B2023-B'], efficiencyGain: '+15%' },
    { id: 2, subject: 'MA-303 (Calculus)', teacher: 'Prof. Charles X.', sections: ['B2022-C', 'B2022-D'], efficiencyGain: '+22%' },
  ];

  const conflicts = [
    { id: 1, type: 'Room Overlap', description: 'Room 101 • CS-501 vs CS-502', fix: 'Move CS-502 to Room 102 (Available 10:00 AM)', severity: 'high' as const },
    { id: 2, type: 'Teacher Double Booked', description: 'Dr. Ahmad • Mon 08:00 AM', fix: 'Shift Physics lab to Tue 09:40 AM', severity: 'high' as const },
    { id: 3, type: 'Batch Gap', description: 'SE-Batch-3 • Wed', fix: 'Move CS-506 to Wed 11:20 AM to fill the gap', severity: 'medium' as const },
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      {/* Page header with tab switcher */}
      <div className="flex items-center gap-1 px-8 pt-6 pb-0 border-b border-slate-200 bg-white">
        <div className="mr-4">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Suggestions</h1>
          <p className="text-xs text-slate-400 font-medium">Smart recommendations for your timetable</p>
        </div>
        <div className="flex items-end gap-1 ml-auto">
          {([
            { id: 'suggestions', label: 'Suggestions', icon: Sparkles },
            { id: 'batch-analysis', label: 'Batch Analysis', icon: GraduationCap },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-xs font-bold transition-all border border-b-0',
                activeTab === tab.id
                  ? 'bg-slate-50 border-slate-200 text-slate-900'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50/50'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'batch-analysis' ? (
        <BatchAnalysis />
      ) : (
        <div className="flex-1 p-8 flex gap-8 overflow-y-auto">
          {/* Main column */}
          <div className="flex-1 space-y-8">

            {/* Merge Suggestions */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-500" />
                    Merge Suggestions
                  </h2>
                  <p className="text-sm text-slate-500">Sections that can be combined to free up rooms and teachers.</p>
                </div>
                <Sparkles className="w-5 h-5 text-emerald-500" />
              </div>

              <div className="grid gap-4">
                {mergeSuggestions.map((rec) => (
                  <div key={rec.id} className="bg-white border border-slate-200 p-6 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                        <Sparkles className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-slate-900 text-lg">{rec.subject}</span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-black uppercase tracking-widest">Merge Potential</span>
                        </div>
                        <p className="text-sm text-slate-500 font-medium">{rec.teacher} • Can merge {rec.sections.join(' & ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Space Efficiency Impact</p>
                        <p className="text-xl font-black text-emerald-600">{rec.efficiencyGain}</p>
                      </div>
                      <button
                        onClick={() => handleApproveMerge(rec.id)}
                        className="bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-lg shadow-slate-900/20"
                      >
                        Approve
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Conflicts */}
            <section className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <CalendarX className="w-5 h-5 text-rose-500" />
                    Conflicts
                  </h2>
                  <p className="text-sm text-slate-500">Scheduling overlaps and unsatisfied constraints.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Needs Attention</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Details</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Suggested Fix</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {conflicts.map((conflict) => (
                      <tr key={conflict.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className={cn("w-4 h-4", conflict.severity === 'high' ? "text-rose-500" : "text-amber-500")} />
                            <span className="font-bold text-slate-900 text-sm">{conflict.type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-600">{conflict.description}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-100">
                            {conflict.fix}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleResolveConflict(conflict.id)}
                            className="text-xs font-bold text-slate-600 hover:text-emerald-600 transition-colors border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg"
                          >
                            Apply Fix
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Sidebar panel */}
          <div className="w-80 space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/10">
              <h3 className="text-lg font-black tracking-tight mb-2 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                System Status
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-6">The scheduler is actively monitoring the timetable for new issues.</p>

              <div className="space-y-4 border-t border-slate-800 pt-6">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Active Checks</h4>
                <div className="space-y-3">
                  {[
                    { label: 'Room Capacity', status: '100% OK', color: 'text-emerald-400' },
                    { label: 'Teacher Overlaps', status: '1 Conflict', color: 'text-rose-400' },
                    { label: 'Batch Gaps', status: '1 Warning', color: 'text-amber-400' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {item.label}
                      </span>
                      <span className={item.color}>{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-emerald-900 mb-2">Did you know?</h3>
              <p className="text-[11px] text-emerald-700/80 leading-relaxed font-medium">
                Approving a merge automatically groups sections into a larger room, freeing up space and reducing teacher workload.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
