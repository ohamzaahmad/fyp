import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Zap, TrendingUp, Users, Clock, AlertTriangle, CheckCircle2, Scissors } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { getAnalyticsSummaryWithParams, generateSchedule } from '../../services/api.ts';
import { getStoredToken, refreshToken } from '../../services/authService.ts';
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
  const [ackIds, setAckIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [bucketMinutes, setBucketMinutes] = useState<number>(Number(process.env.VITE_ANALYTICS_BUCKET_MINUTES || 60));
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const toast = useToast();

  const palette = ['#10b981', '#3b82f6', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4', '#f59e0b', '#84cc16', '#e11d48', '#0ea5a4'];

  const formatMinutesShort = (v: number | undefined) => {
    const m = Math.round(Number(v || 0));
    if (m >= 60) return `${Math.floor(m / 60)}h`;
    return `${m}m`;
  };

  const formatMinutesFull = (v: number | undefined) => {
    const m = Math.round(Number(v || 0));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h === 0) return `${mm}m`;
    if (mm === 0) return `${h}h`;
    return `${h}h ${mm}m`;
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const s = await getAnalyticsSummaryWithParams({ bucket_minutes: bucketMinutes });
        if (!mounted) return;
        setSummary(s || null);
        setLogs(Array.isArray(s?.logs) ? s.logs : (s && s.logs ? s.logs : s?.logs || []));
        setLoadData(s?.load_distribution || null);
        const feedArray = Array.isArray(s?.feed) ? s.feed : (Array.isArray(s?.logs) ? s.logs : []);
        setFeed(feedArray);
      } catch (e) {
        console.warn('Dashboard: failed to load analytics', e);
        try { toast.show('Failed to load analytics', 'error'); } catch(_){ }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [bucketMinutes]);

  // SSE: connect to analytics stream with token renewal and reconnect logic
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const POLL_INTERVAL_MS = 10000;
    const RECONNECT_MAX_BACKOFF = 30000;
    const SAFETY_MARGIN_MS = 30 * 1000; // refresh token 30s before expiry

    let es: EventSource | null = null;
    let pollId: number | null = null;
    let refreshTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let backoff = 1000;

    const startPolling = () => {
      if (pollId) return;
      pollId = window.setInterval(async () => {
        try {
          const s = await getAnalyticsSummaryWithParams({ bucket_minutes: bucketMinutes });
          setSummary(s || null);
          setLoadData(s?.load_distribution || null);
          const feedArray = Array.isArray(s?.feed) ? s.feed : (Array.isArray(s?.logs) ? s.logs : []);
          setFeed(feedArray);
        } catch (e) {
          // ignore polling errors
        }
      }, POLL_INTERVAL_MS) as unknown as number;
    };

    const stopPolling = () => {
      if (pollId) {
        clearInterval(pollId);
        pollId = null;
      }
    };

    const clearTimers = () => {
      if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    };

    const buildStreamUrl = (token?: string) => token ? `/api/analytics/stream/?token=${encodeURIComponent(token)}` : '/api/analytics/stream/';

    const scheduleTokenRefresh = (token?: string) => {
      if (!token) return;
      try {
        const parts = token.split('.');
        if (parts.length < 2) return;
        const payload = JSON.parse(decodeURIComponent(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')).split('').map(function(c){
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')));
        const exp = payload?.exp;
        if (!exp) return;
        const msUntilExpiry = (exp * 1000) - Date.now();
        const when = Math.max(0, msUntilExpiry - SAFETY_MARGIN_MS);
        if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
        if (when <= 0) {
          // token already near expiry — refresh immediately
          (async () => {
            try {
              await refreshToken();
              const nt = getStoredToken();
              // reconnect with new token
              try { es?.close(); } catch(_){ }
              openEventSource(nt);
            } catch (e) {
              // ignore
            }
          })();
        } else {
          refreshTimer = window.setTimeout(async () => {
            try {
              await refreshToken();
              const nt = getStoredToken();
              try { es?.close(); } catch(_){ }
              openEventSource(nt);
            } catch (e) {
              // if refresh fails, fall back to polling
              startPolling();
            }
          }, when) as unknown as number;
        }
      } catch (e) {
        // ignore parse errors
      }
    };

    const openEventSource = (token?: string) => {
      try {
        // close previous
        try { es?.close(); } catch (_) {}

        const streamUrl = buildStreamUrl(token);
        es = new EventSource(streamUrl);

        es.onopen = () => {
          stopPolling();
          if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
          backoff = 1000;
          scheduleTokenRefresh(token);
        };

        es.onmessage = async (evt) => {
          try {
            const data = JSON.parse(evt.data);
            setFeed(prev => {
              if (!data || !data.id) return prev;
              const exists = prev.some((it: any) => String(it.id) === String(data.id));
              if (exists) return prev;
              const next = [...prev, data];
              const limit = Number(process.env.VITE_ANALYTICS_FEED_LIMIT || 50);
              return next.slice(-limit);
            });
            try {
              const s = await getAnalyticsSummaryWithParams({ bucket_minutes: bucketMinutes });
              setSummary(s || null);
              setLoadData(s?.load_distribution || null);
            } catch (e) {
              // ignore summary refresh errors
            }
          } catch (err) {
            // ignore malformed messages
          }
        };

        es.onerror = async () => {
          // Try to refresh token and reconnect once
          try {
            await refreshToken();
            const nt = getStoredToken();
            try { es?.close(); } catch(_){ }
            openEventSource(nt);
          } catch (e) {
            // refresh failed — fall back to polling and schedule reconnect with backoff
            startPolling();
            if (!reconnectTimer) {
              reconnectTimer = window.setTimeout(() => {
                try { openEventSource(getStoredToken()); } catch (_) { startPolling(); }
                reconnectTimer = null;
              }, backoff) as unknown as number;
              backoff = Math.min(backoff * 2, RECONNECT_MAX_BACKOFF);
            }
          }
        };
      } catch (e) {
        // fallback to polling
        startPolling();
      }
    };

    // bootstrap
    const initialToken = getStoredToken();
    if (initialToken) {
      openEventSource(initialToken);
    } else {
      startPolling();
    }

    return () => {
      try { es?.close(); } catch (_) {}
      stopPolling();
      clearTimers();
    };
  }, [bucketMinutes]);

  return (
    <div className="flex-1 p-8 bg-slate-50 overflow-y-auto" data-tour="dashboard-overview">
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
              <div className="flex gap-4 items-center">
                {loadData && Array.isArray(loadData.series) && loadData.series.length > 0 ? (
                  loadData.series.map((s: any, i: number) => (
                    <div key={s.department} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: palette[i % palette.length] }} />
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{s.department}</span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase">CS</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Physics</span>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Bucket</label>
                  <select value={bucketMinutes} onChange={e => setBucketMinutes(Number(e.target.value))} className="text-xs bg-slate-50 border border-slate-100 rounded px-2 py-1">
                    <option value={30}>30m</option>
                    <option value={60}>60m</option>
                    <option value={120}>120m</option>
                  </select>
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
                    {(loadData?.series || []).map((s: any, idx: number) => (
                      <linearGradient key={s.department} id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={palette[idx % palette.length]} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={palette[idx % palette.length]} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} tickFormatter={formatMinutesShort} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }}
                    itemStyle={{ fontWeight: 'bold' }}
                    formatter={(value: any) => formatMinutesFull(value)}
                  />
                  {(loadData?.series || []).map((s: any, idx: number) => (
                    <Area key={s.department} type="monotone" dataKey={s.department} stroke={palette[idx % palette.length]} strokeWidth={3} fill={`url(#grad-${idx})`} fillOpacity={1} />
                  ))}
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
              {(feed && feed.length > 0 ? feed : logs).map((raw: any, i: number) => {
                const id = String(raw?.id ?? raw?.pk ?? `log-${i}`);
                const time = raw?.created_at ? new Date(raw.created_at).toLocaleString() : (raw?.time || '');
                const message = raw?.message ?? raw?.msg ?? String(raw?.payload ?? raw ?? '');
                const evType = (raw?.event_type || raw?.type || '').toLowerCase();
                const type = evType.includes('fail') || evType.includes('error') ? 'error' : (evType.includes('fin') || evType.includes('complete') || evType.includes('enqueued') || evType.includes('start') ? 'success' : (evType.includes('warn') ? 'warning' : 'info'));
                const payload = raw?.payload || {};
                const acknowledged = ackIds.includes(id);
                const expanded = expandedIds.includes(id);

                const colorClass = type === 'error' ? 'text-rose-400' : type === 'success' ? 'text-emerald-400' : type === 'warning' ? 'text-amber-400' : 'text-blue-400';

                return (
                  <div key={id} className={cn('flex gap-4 items-start group', acknowledged ? 'opacity-40' : '')}>
                    <div className="pt-0.5">
                      <div className={cn('w-2 h-2 rounded-full mt-1', type === 'error' ? 'bg-rose-400' : type === 'success' ? 'bg-emerald-400' : type === 'warning' ? 'bg-amber-400' : 'bg-blue-400')} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={cn('text-[10px] font-bold tracking-tight', colorClass)}>{message}</div>
                          <div className="text-[9px] text-slate-500 font-mono mt-1">{time}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => {
                            navigator.clipboard?.writeText(message).catch(()=>{});
                          }} className="text-[10px] px-2 py-1 bg-slate-800/20 rounded text-slate-200 hover:bg-slate-800/30">Copy</button>
                          <button onClick={() => {
                            setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                          }} className="text-[10px] px-2 py-1 bg-slate-800/20 rounded text-slate-200 hover:bg-slate-800/30">Details</button>
                          <button onClick={() => {
                            setAckIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                          }} className="text-[10px] px-2 py-1 bg-slate-800/20 rounded text-slate-200 hover:bg-slate-800/30">{acknowledged ? 'Unack' : 'Ack'}</button>
                        </div>
                      </div>
                      {expanded && (
                        <pre className="mt-2 bg-slate-800 text-[11px] p-3 rounded text-slate-100 overflow-x-auto">{JSON.stringify(payload, null, 2)}</pre>
                      )}
                    </div>
                  </div>
                );
              })}
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
