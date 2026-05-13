import React, { useEffect, useState } from 'react';
import { fetchDepartmentsRaw, createDepartment, deleteDepartment } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';

const Departments: React.FC = () => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [newDept, setNewDept] = useState('');
  const toast = useToast();
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;
    fetchDepartmentsRaw()
      .then((res) => {
        if (!mounted) return;
        if (!res) { setDepartments([]); return; }
        // normalize to objects {id?, code?, name}
        const normalized = res.map((r: any) => {
          if (typeof r === 'string') return { id: null, code: (r || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,10), name: r };
          return { id: r.id || null, code: r.code || (r.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,10), name: r.name || r.label || String(r) };
        });
        setDepartments(normalized);
      })
      .catch(() => toast.show('Failed to load departments', 'error'));
    return () => { mounted = false; };
  }, []);

  const reload = async () => {
    try {
      const res = await fetchDepartmentsRaw();
      const normalized = res.map((r: any) => (typeof r === 'string' ? { id: null, code: (r || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,10), name: r } : { id: r.id || null, code: r.code || (r.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,10), name: r.name || r.label }));
      setDepartments(normalized);
    } catch (e) {
      toast.show('Failed to reload departments', 'error');
    }
  };

  const create = async () => {
    const name = (newDept || '').trim();
    if (!name) { toast.show('Enter a name', 'info'); return; }
    if (!user || user.role !== 'ADMIN') { toast.show('Admin privileges required', 'error'); return; }
    const code = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || `D${Date.now().toString().slice(-4)}`;
    try {
      await createDepartment({ code, name });
      toast.show('Department created', 'success');
      setNewDept('');
      await reload();
    } catch (e) {
      toast.show('Failed to create department', 'error');
    }
  };

  const remove = async (d: any) => {
    if (!d || !d.id) {
      // local-only entry
      setDepartments(prev => prev.filter(p => p !== d));
      return;
    }
    if (!confirm('Delete this department?')) return;
    try {
      await deleteDepartment(d.id);
      toast.show('Department deleted', 'success');
      await reload();
    } catch (e) {
      toast.show('Failed to delete department', 'error');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black text-slate-900">Departments</h1>
      <p className="text-sm text-slate-500 mt-1">All departments (persisted rows and legacy choices).</p>

      <div className="mt-6 bg-white p-4 rounded-lg shadow border">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 mb-3">All Departments</h3>
        </div>

        <ul className="mt-3 grid grid-cols-2 gap-2">
          {departments.map((d, i) => (
            <li key={i} className="px-3 py-2 rounded flex items-center justify-between bg-slate-50 border border-slate-100 text-slate-700">
              <span>{d.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{d.id ? 'backend' : 'legacy'}</span>
                {d.id && <button onClick={() => remove(d)} className="px-2 py-1 border rounded text-xs text-rose-600">Delete</button>}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t pt-4">
          <div className="flex gap-2">
            <input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="New department name" className="flex-1 px-3 py-2 border rounded" />
            <button onClick={create} className="px-4 py-2 bg-emerald-500 text-white rounded font-bold">Create</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Departments;
