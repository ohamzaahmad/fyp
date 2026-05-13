import React from 'react';
import { Sparkles, Users, FileBarChart, Check, Trash2, ArrowUpRight } from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { cn } from '../../lib/utils.ts';

export const ControlRoom: React.FC = () => {
  const { teachers = [] } = useData();
  return (
    <div className="flex-1 p-8 bg-slate-50 flex gap-8">
      {/* Main Panel */}
      <div className="flex-1 space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Merge Recommender</h2>
              <p className="text-sm text-slate-500">AI-suggested session consolidations based on subject symmetry.</p>
            </div>
            <Sparkles className="w-5 h-5 text-emerald-500" />
          </div>

          <div className="grid gap-4">
            {[
              { id: 1, subject: 'CS101', teacher: 'Dr. Sarah Connor', sections: ['B2023-A', 'B2023-B'], efficiencyGain: '+15%' },
              { id: 2, subject: 'MA303', teacher: 'Prof. Charles X.', sections: ['B2022-C', 'B2022-D'], efficiencyGain: '+22%' },
            ].map((rec) => (
              <div key={rec.id} className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-100 p-2 rounded-lg">
                    <Users className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{rec.subject}</span>
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-black uppercase">Merge Pot.</span>
                    </div>
                    <p className="text-xs text-slate-500">{rec.teacher} • {rec.sections.join(' & ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Impact</p>
                    <p className="text-sm font-black text-emerald-600">{rec.efficiencyGain}</p>
                  </div>
                  <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2">
                    Approve Merge
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Teacher Priorities</h2>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tier 1 Optimized</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teacher Name</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dept</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Priority</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(teachers || []).map((f) => (
                  <tr key={f.id} className="group hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-bold text-slate-900 text-sm">{f.name}</td>
                    <td className="px-6 py-3 text-xs text-slate-500">{f.department}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-4">
                        <input 
                          type="range" min="1" max="10" defaultValue={10 - f.tier * 2} 
                          className="w-32 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                          f.tier === 1 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}>
                          Tier {f.tier}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Right Rail: Bulk Actions */}
      <div className="w-80 space-y-6">
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/10">
          <h3 className="text-lg font-black tracking-tight mb-4 flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-emerald-500" />
            Bulk Import
          </h3>
          <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer group">
            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <ArrowUpRight className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-slate-300">Drop CSV / Excel</p>
            <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest font-black">Max 10MB</p>
          </div>
          
          <div className="mt-8 space-y-4">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Safety Checks</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>Room Capacity Validation</span>
                <Check className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                        <span>Teacher Overlap Check</span>
                <Check className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold text-slate-900 mb-2">Export Summary</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed mb-4">Last optimized: Today, 02:45 PM. Next scheduled sync: 00:00 AM.</p>
          <div className="h-24 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center italic text-slate-300 text-xs text-center px-4">
            Current system utilization is at 82% across all buildings.
          </div>
        </div>
      </div>
    </div>
  );
};
