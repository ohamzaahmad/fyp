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
    <div className="max-w-4xl">
      <div className="mb-6 flex gap-4 items-end bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">New Department Name</label>
          <input 
            value={newDept} 
            onChange={(e) => setNewDept(e.target.value)} 
            placeholder="e.g. Computer Science" 
            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
          />
        </div>
        <button 
          onClick={create} 
          className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
        >
          Create
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-black text-slate-800 text-sm tracking-tight uppercase">Active Departments</h3>
        </div>
        <ul className="divide-y divide-slate-100">
          {departments.map((d, i) => (
            <li key={i} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
              <span className="font-bold text-slate-700 text-sm">{d.name}</span>
              <div className="flex items-center gap-4">
                {d.id ? (
                  <button onClick={() => remove(d)} className="text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100">Remove</button>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">Legacy</span>
                )}
              </div>
            </li>
          ))}
          {departments.length === 0 && (
            <li className="px-6 py-8 text-center text-sm font-medium text-slate-400">
              No departments found. Add one above.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default Departments;
