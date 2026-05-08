import { useEffect, useState } from 'react';
import { getMasterTimetable } from '../../services/api.ts';
import { NexusMasterMap } from '../../types.ts';

export default function MasterMapViewer() {
  const [data, setData] = useState<NexusMasterMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMasterTimetable();
      setData(res);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold">MasterMap (debug)</h4>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs text-slate-600 hover:underline">Refresh</button>
        </div>
      </div>
      {loading && <div className="text-sm text-slate-500">Loading...</div>}
      {error && <div className="text-sm text-red-500">Error: {error}</div>}
      {data && (
        <pre className="text-xs overflow-auto max-h-80 bg-slate-50 p-2 rounded">{JSON.stringify(data, null, 2)}</pre>
      )}
      {!loading && !error && !data && (
        <div className="text-sm text-slate-500">No data</div>
      )}
    </div>
  );
}
