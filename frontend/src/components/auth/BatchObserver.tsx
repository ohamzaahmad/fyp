import React, { useEffect, useState } from 'react';
import { getMasterTimetable, downloadBatchTimetable, fetchBatches } from '../../services/api.ts';
import { NexusMasterMap, Batch } from '../../types.ts';
import { useToast } from '../ui/Toast.tsx';
import { Download } from 'lucide-react';

export const BatchObserver: React.FC = () => {
  const [map, setMap] = useState<NexusMasterMap | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const batchesData = await fetchBatches();
        setBatches(batchesData);
        const m = await getMasterTimetable();
        setMap(m);
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

  const downloadTimetable = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const blob = await downloadBatchTimetable(selected);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${selected}-timetable.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      try { toast.show('PDF download started', 'success'); } catch (_) {}
    } catch (e: any) {
      setError(e?.message || String(e));
      try { toast.show(`Download failed: ${e?.message || String(e)}`, 'error'); } catch(_) {}
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm" data-tour="batch-observer">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold" data-tour="batch-observer-title">Download Timetable</h3>
        <button onClick={() => { setMap(null); setBatches([]); setSelected(null); setSessions([]); }} className="text-xs text-slate-400 hover:underline">Clear</button>
      </div>

      {loading && <div className="text-xs text-slate-500">Loading batches...</div>}
      {error && <div className="text-xs text-red-500">Error: {error}</div>}

      {!loading && !error && (
        <div>
          <select data-tour="batch-select" value={selected ?? ''} onChange={(e) => setSelected(e.target.value || null)} className="w-full p-2 border rounded mb-3 text-sm">
            <option value="">-- Select Batch --</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name || b.id}</option>)}
          </select>

          {selected && (
            <div className="text-xs">
              <div className="mb-2 text-slate-600">Sessions for <strong>{selected}</strong> ({sessions.length})</div>
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                <button 
                  data-tour="batch-download-pdf"
                  onClick={downloadTimetable} 
                  disabled={loading}
                  className="text-xs bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download PDF
                </button>
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
