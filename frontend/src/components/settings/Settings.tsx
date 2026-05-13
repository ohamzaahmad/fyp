import React, { useEffect, useState } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { setApiBaseUrl, generateSchedule } from '../../services/api.ts';
import api from '../../services/api.ts';

type Constraints = {
  breakStart: string;
  breakEnd: string;
  maxDailyClasses: number;
  gapPenalty: number;
};

export const Settings: React.FC = () => {
  const data = useData();
  const { logout } = useAuth();

  const [apiUrl, setApiUrl] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [headerVisible, setHeaderVisible] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [constraints, setConstraints] = useState<Constraints>({ breakStart: '13:00', breakEnd: '14:00', maxDailyClasses: 6, gapPenalty: 1 });

  useEffect(() => {
    const storedApi = typeof window !== 'undefined' ? localStorage.getItem('nexus_api_base') : null;
    const envApi = (import.meta as any).env?.VITE_API_URL as string | undefined;
    setApiUrl(storedApi || envApi || '/api');

    const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('nexus_theme') : null;
    if (storedTheme === 'dark' || (!storedTheme && document.documentElement.classList.contains('dark'))) setTheme('dark');
    else setTheme('light');

    const storedHeader = typeof window !== 'undefined' ? localStorage.getItem('nexus_header_visible') : null;
    setHeaderVisible(storedHeader === null ? true : storedHeader === 'true');

    const storedConstraints = typeof window !== 'undefined' ? localStorage.getItem('nexus_constraints') : null;
    if (storedConstraints) {
      try {
        const parsed = JSON.parse(storedConstraints);
        setConstraints(c => ({ ...c, ...parsed }));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const applyTheme = (t: 'light' | 'dark') => {
    if (t === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('nexus_theme', t);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update API base URL runtime
      setApiBaseUrl(apiUrl && apiUrl !== '' ? apiUrl : null);

      // Apply theme
      applyTheme(theme);

      // Header visibility
      localStorage.setItem('nexus_header_visible', headerVisible ? 'true' : 'false');
      // Notify app of header visibility change
      window.dispatchEvent(new CustomEvent('nexus:settings-updated', { detail: { headerVisible } }));

      // Persist solver constraints locally and notify
      try {
        localStorage.setItem('nexus_constraints', JSON.stringify(constraints));
        window.dispatchEvent(new CustomEvent('nexus:constraints-updated', { detail: constraints }));
      } catch (e) {
        console.warn('Failed to save constraints', e);
      }

      // Persist constraints server-side for admins when possible
      try {
        await api.post('/timetable/constraints/', {
          break_start: constraints.breakStart,
          break_end: constraints.breakEnd,
          max_daily_classes: constraints.maxDailyClasses,
          gap_penalty: constraints.gapPenalty,
        });
      } catch (err) {
        // Ignore failures (user may be unauthenticated or not admin)
      }

      // Optionally refresh public data
      try {
        await data.refreshAll();
      } catch (e) {
        // ignore
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutClear = () => {
    // Clear tokens and reload
    logout();
    // Also clear runtime data
    localStorage.removeItem('__NEXUS_DATA__');
    localStorage.removeItem('nexus_api_base');
    localStorage.removeItem('nexus_theme');
    localStorage.removeItem('nexus_header_visible');
  };

  return (
    <div className="flex-1 p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-black mb-4">System Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold block mb-1">API Base URL</label>
            <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="w-full border border-slate-200 rounded px-3 py-2" />
            <p className="text-xs text-slate-400 mt-1">Runtime override for backend API base. Empty or '/api' uses relative path.</p>
          </div>

          <div>
            <label className="text-sm font-bold block mb-1">Theme</label>
            <div className="flex gap-2">
              <button onClick={() => setTheme('light')} className={`px-3 py-2 rounded ${theme === 'light' ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>Light</button>
              <button onClick={() => setTheme('dark')} className={`px-3 py-2 rounded ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>Dark</button>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold block mb-1">Top Bar</label>
            <div className="flex items-center gap-3">
              <input id="headerVisible" type="checkbox" checked={headerVisible} onChange={(e) => setHeaderVisible(e.target.checked)} />
              <label htmlFor="headerVisible" className="text-sm">Show top bar</label>
            </div>
            <p className="text-xs text-slate-400 mt-1">Toggle the header visibility for a compact workspace.</p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="bg-emerald-500 text-white px-4 py-2 rounded font-bold">{saving ? 'Saving...' : 'Save & Apply'}</button>
            <button onClick={() => data.refreshAll()} className="px-4 py-2 rounded border border-slate-200">Refresh Data</button>
            <button onClick={handleLogoutClear} className="px-4 py-2 rounded border border-rose-200 text-rose-600">Logout & Clear</button>
          </div>
          
          <div className="mt-6 border-t pt-4">
            <h3 className="font-bold mb-2">Solver Constraints (runtime)</h3>
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-xs block mb-1">Break Start</label>
                <input type="time" value={constraints.breakStart} onChange={(e) => setConstraints(c => ({ ...c, breakStart: e.target.value }))} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-xs block mb-1">Break End</label>
                <input type="time" value={constraints.breakEnd} onChange={(e) => setConstraints(c => ({ ...c, breakEnd: e.target.value }))} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-xs block mb-1">Max Daily Classes</label>
                <input type="number" min={1} max={12} value={constraints.maxDailyClasses} onChange={(e) => setConstraints(c => ({ ...c, maxDailyClasses: Number(e.target.value) }))} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-xs block mb-1">Gap Penalty Weight</label>
                <input type="number" min={0} step={0.1} value={constraints.gapPenalty} onChange={(e) => setConstraints(c => ({ ...c, gapPenalty: Number(e.target.value) }))} className="w-full border rounded px-2 py-1" />
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button onClick={async () => {
                setSaving(true);
                try {
                  // send constraints to the generate endpoint (backend may accept them)
                  const res = await generateSchedule({ constraints });
                  // simple user feedback; UI can be improved
                  alert(`Solver task: ${res?.task_id || 'enqueued'}`);
                } catch (err) {
                  console.error(err);
                  alert('Failed to start solver with provided constraints');
                } finally {
                  setSaving(false);
                }
              }} className="px-4 py-2 rounded bg-indigo-600 text-white">Run Solver with Constraints</button>
              <button onClick={() => {
                localStorage.removeItem('nexus_constraints');
                setConstraints({ breakStart: '13:00', breakEnd: '14:00', maxDailyClasses: 6, gapPenalty: 1 });
                window.dispatchEvent(new CustomEvent('nexus:constraints-updated', { detail: null }));
              }} className="px-4 py-2 rounded border">Reset Constraints</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
