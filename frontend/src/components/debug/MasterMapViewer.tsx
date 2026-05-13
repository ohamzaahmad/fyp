import { useEffect } from 'react';
import { MasterMap } from '../../types.ts';
import { useData } from '../../context/DataContext.tsx';

export default function MasterMapViewer() {
  const data = useData();

  const master = data?.masterMap || null;
  const loading = data?.isLoading;
  const error = data?.error || null;

  return (
    <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold">MasterMap (debug)</h4>
        <div className="flex items-center gap-2">
          <button onClick={data?.refreshMasterMap} className="text-xs text-slate-600 hover:underline">Refresh</button>
        </div>
      </div>
      {loading && <div className="text-sm text-slate-500">Loading...</div>}
      {error && <div className="text-sm text-red-500">Error: {error}</div>}
      {master && (
        <pre className="text-xs overflow-auto max-h-80 bg-slate-50 p-2 rounded">{JSON.stringify(master, null, 2)}</pre>
      )}
      {!loading && !error && !master && (
        <div className="text-sm text-slate-500">No data</div>
      )}
    </div>
  );
}
