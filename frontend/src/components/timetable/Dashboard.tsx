import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Zap, TrendingUp, Users, Clock, AlertTriangle, CheckCircle2, Scissors } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { getAnalyticsSummary, getAnalyticsLogs, getAnalyticsLoadDistribution, getAnalyticsFeed, generateSchedule } from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';

const DATA = [
  { name: '08:00', cs: 12, phy: 8, math: 5 },
  { name: '10:00', cs: 15, phy: 10, math: 7 },
  { name: '12:00', cs: 8, phy: 4, math: 3 },
  { name: '14:00', cs: 18, phy: 12, math: 9 },
  { name: '16:00', cs: 10, phy: 6, math: 4 },
  { name: '18:00', cs: 4, phy: 2, math: 2 },
];

export const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadData, setLoadData] = useState<any | null>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [s, l, ld, f] = await Promise.all([getAnalyticsSummary(), getAnalyticsLogs(), getAnalyticsLoadDistribution(), getAnalyticsFeed()]);
        if (!mounted) return;
        setSummary(s || null);
        setLogs(Array.isArray(l?.logs) ? l.logs : (l && l.logs ? l.logs : l?.logs || []));
        setLoadData(ld || null);
        setFeed(Array.isArray(f?.feed) ? f.feed : (f && f.feed ? f.feed : f?.feed || []));
      } catch (e) {
        console.warn('Dashboard: failed to load analytics', e);
        try { toast.show('Failed to load analytics', 'error'); } catch(_){}
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="flex-1 p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">Overview</span>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mt-1">Dashboard</h1>
          </div>
          <div className="flex gap-3">
             <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Live</span>
             </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Efficiency', value: summary ? `${summary.systemEfficiency}%` : '—', icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { label: 'Room Utilization', value: summary ? `${summary.roomUtilization}%` : '—', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
            { label: 'Teacher Satisfaction', value: summary ? `${summary.facultySatisfaction}%` : '—', icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
            { label: 'Schedule Continuity', value: summary ? `${summary.batchContinuity}%` : '—', icon: Scissors, color: 'text-amber-500', bg: 'bg-amber-50' },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-transform hover:scale-[1.02]">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:rotate-12", stat.bg)}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-8 mb-8">
          {/* Main Chart */}
          <div className="col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Load by Department</h3>
              <div className="flex gap-4">
                 <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-emerald-500" />
                   <span className="text-[9px] font-bold text-slate-400 uppercase">CS</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-blue-500" />
                   <span className="text-[9px] font-bold text-slate-400 uppercase">Physics</span>
                 </div>
              </div>
            </div>
            <div className="h-64" style={{ minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={
                  // transform loadData into recharts-friendly shape
                  (loadData && loadData.times && Array.isArray(loadData.series)) ?
                    loadData.times.map((t: string, idx: number) => {
                      const row: any = { name: t };
                      loadData.series.forEach((s: any) => { row[s.department] = s.values[idx] || 0; });
                      return row;
                    }) : DATA
                }>
                  <defs>
                    <linearGradient id="colorCs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  {/* Render first two departments as examples; fallback to known keys */}
                  {loadData && loadData.series && loadData.series[0] && (
                    <Area type="monotone" dataKey={loadData.series[0].department} stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCs)" />
                  )}
                  {loadData && loadData.series && loadData.series[1] && (
                    <Area type="monotone" dataKey={loadData.series[1].department} stroke="#3b82f6" strokeWidth={3} fill="transparent" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Conflict Live Feed */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/10 flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-tight mb-6 flex items-center justify-between">
              System Logs
              <span className="bg-rose-500 text-[8px] px-1.5 py-0.5 rounded ml-2 animate-pulse">Live</span>
            </h3>
            <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar">
              {(feed && feed.length > 0 ? feed : logs).map((log: any, i: number) => (
                <div key={i} className="flex gap-4 group">
                  <span className="text-[9px] font-mono text-slate-500 pt-0.5">{log.time}</span>
                  <div>
                    <p className={cn(
                      "text-[10px] font-bold tracking-tight",
                      log.type === 'error' ? "text-rose-400" : 
                      log.type === 'success' ? "text-emerald-400" :
                      log.type === 'warning' ? "text-amber-400" : "text-blue-400"
                    )}>
                      {log.msg}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[8px] uppercase font-black text-slate-600 group-hover:text-slate-500 transition-colors">Action Required &rarr;</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-8 w-full border border-slate-700 bg-slate-800/50 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">Clear All Logs</button>
          </div>
        </div>

        {/* Action Blocks */}
        <div className="grid grid-cols-2 gap-8">
           <div className="bg-emerald-500 p-8 rounded-3xl relative overflow-hidden group border border-emerald-400">
              <div className="absolute top-0 right-0 p-8 opacity-10 transition-transform group-hover:scale-125 duration-500">
                 <Scissors className="w-40 h-40 text-white" />
              </div>
              <div className="relative z-10">
                 <h2 className="text-3xl font-black text-white tracking-tight mb-2">Optimize Schedule</h2>
                 <p className="max-w-xs text-emerald-50 font-medium leading-relaxed mb-6">Found sections with large time gaps. Run the optimizer to compact the timetable?</p>
                 <button onClick={async () => {
                    if (running) return;
                    setRunning(true);
                    try {
                      const res = await generateSchedule();
                      if (res && res.task_id) {
                        toast.show(`Solver enqueued: ${res.task_id}`, 'success');
                      } else if (res && res.status) {
                        toast.show(`Solver started: ${res.status}`, 'info');
                      } else {
                        toast.show('Solver request sent', 'info');
                      }
                    } catch (e: any) {
                      toast.show(`Failed to run solver: ${e?.message || String(e)}`, 'error');
                    } finally {
                      setRunning(false);
                    }
                 }} className="bg-white text-emerald-600 px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-900/20">{running ? 'Running...' : 'Run Now'}</button>
              </div>
           </div>

           <div className="bg-white border-2 border-slate-100 p-8 rounded-3xl flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-4">
                 <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500">?</div>
                 <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Need Support?</h3>
                    <p className="text-sm font-medium text-slate-400">Browse help docs or check server status</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <button className="bg-slate-50 border border-slate-200 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-colors">Docs</button>
                 <button className="bg-slate-50 border border-slate-200 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-colors">System Status</button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
