import React, { useEffect, useState } from 'react';
import { getMasterTimetable, getBatchDiagnostic } from '../../services/api.ts';
import { NexusMasterMap } from '../../types.ts';
import { useToast } from '../ui/Toast.tsx';

export const BatchObserver: React.FC = () => {
  const [map, setMap] = useState<NexusMasterMap | null>(null);
  const [batches, setBatches] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<any | null>(null);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const m = await getMasterTimetable();
        setMap(m);
        const found = new Set<string>();
        Object.values(m).forEach((b: any) => {
          Object.values(b.floors || {}).forEach((f: any) => {
            Object.values(f.rooms || {}).forEach((r: any) => {
              (r.sessions || []).forEach((s: any) => {
                if (s.batchId) found.add(s.batchId);
              });
            });
          });
        });
        setBatches(Array.from(found).sort());
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!map || !selected) return setSessions([]);
    const out: any[] = [];
    Object.values(map).forEach((b: any) => {
      Object.values(b.floors || {}).forEach((f: any) => {
        Object.values(f.rooms || {}).forEach((r: any) => {
          (r.sessions || []).forEach((s: any) => {
            if (s.batchId === selected) {
              out.push({ ...s, roomName: `${b.name} / ${r.name}` });
            }
          });
        });
      });
    });
    setSessions(out.sort((a, b) => a.startTime.localeCompare(b.startTime)));
  }, [map, selected]);

  const runDiagnostic = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await getBatchDiagnostic(selected);
      setDiagnostic(res);
      try { toast.show(`Diagnostic complete: ${res.continuity}% continuity`, 'success'); } catch (_) {}
    } catch (e: any) {
      setError(e?.message || String(e));
      try { toast.show(`Diagnostic failed: ${e?.message || String(e)}`, 'error'); } catch(_) {}
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold">Batch Diagnostic (no login)</h3>
        <button onClick={() => { setMap(null); setBatches([]); setSelected(null); setSessions([]); }} className="text-xs text-slate-400 hover:underline">Clear</button>
      </div>

      {loading && <div className="text-xs text-slate-500">Loading batches...</div>}
      {error && <div className="text-xs text-red-500">Error: {error}</div>}

      {!loading && !error && (
        <div>
          <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value || null)} className="w-full p-2 border rounded mb-3 text-sm">
            <option value="">-- Select Batch --</option>
            {batches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          {selected && (
            <div className="text-xs">
              <div className="mb-2 text-slate-600">Sessions for <strong>{selected}</strong> ({sessions.length})</div>
              <div className="mb-3 flex items-center gap-3">
                <button onClick={runDiagnostic} className="text-xs bg-slate-100 px-3 py-1 rounded text-slate-700 hover:bg-slate-50">Run Diagnostic</button>
                {diagnostic && <div className="text-[11px] text-slate-500">Continuity: <strong className="ml-1">{diagnostic.continuity}%</strong> • Sessions: <strong>{diagnostic.sessions}</strong></div>}
              </div>
              <ul className="space-y-2 max-h-48 overflow-auto">
                {sessions.map(s => (
                  <li key={s.id} className="p-2 bg-slate-50 rounded">
                    <div className="text-sm font-bold">{s.subjectCode} {s.subjectName ? `- ${s.subjectName}` : ''}</div>
                    <div className="text-[11px] text-slate-500">{s.startTime} • {s.durationMinutes}m • {s.roomName}</div>
                  </li>
                ))}
                {sessions.length === 0 && <li className="text-xs text-slate-500">No sessions found for this batch.</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchObserver;
