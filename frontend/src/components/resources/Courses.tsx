import React, { useEffect, useState } from 'react';
import api from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';
import { Course, Department } from '../../types.ts';
import { useData } from '../../context/DataContext.tsx';

const initial: Partial<Course> = { course_id: '', name: '', department: [] as number[] };

const Courses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<Course>(initial as Course);
  const [editingId, setEditingId] = useState<number | null>(null);
  const toast = useToast();

  // Small searchable multi-select component
  const SearchableMultiSelect: React.FC<{
    options: Department[];
    value: number[];
    onChange: (v: number[]) => void;
    placeholder?: string;
  }> = ({ options, value, onChange, placeholder }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const filtered = options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()));

    const toggle = (id: number) => {
      const arr = Array.isArray(value) ? [...value] : [];
      const idx = arr.indexOf(id);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(id);
      onChange(arr);
    };

    return (
      <div className="relative">
        <div onClick={() => setOpen(!open)} className="w-full min-h-[44px] flex items-center gap-2 flex-wrap border rounded px-2 py-1 cursor-text" role="button">
          {Array.isArray(value) && value.length > 0 ? (
            value.map(v => {
              const d = options.find(o => o.id === v);
              return d ? <span key={v} className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium">{d.name}</span> : null;
            })
          ) : (
            <span className="text-slate-400 text-sm">{placeholder || 'Select...'}</span>
          )}
        </div>

        {open && (
          <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow-lg p-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." className="w-full px-3 py-2 border rounded mb-2" />
            <div className="max-h-48 overflow-y-auto">
              {filtered.map(o => (
                <label key={o.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                  <input type="checkbox" checked={Array.isArray(value) && value.includes(o.id)} onChange={() => toggle(o.id)} className="w-4 h-4" />
                  <span className="text-sm">{o.name}</span>
                </label>
              ))}
              {filtered.length === 0 && <div className="text-sm text-slate-400 p-2">No departments</div>}
            </div>
            <div className="mt-2 text-right">
              <button onClick={() => setOpen(false)} className="px-3 py-1 border rounded text-sm">Close</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const data = useData();
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [c, d] = await Promise.all([data.fetchCourses(), data.fetchDepartments()]);
        if (!mounted) return;
        setCourses(c || []);
        setDepartments(d || []);
      } catch (e) {
        toast.show('Failed to load courses or departments', 'error');
      }
    })();
    return () => { mounted = false; };
  }, [data.fetchCourses, data.fetchDepartments]);

  const submit = async () => {
    if (!form.course_id || !form.name || !(form.department && form.department.length > 0)) {
      toast.show('Please fill all fields', 'error');
      return;
    }
    try {
      if (editingId) {
        await api.patch(`/courses/${editingId}/`, form);
        toast.show('Course updated', 'success');
      } else {
        await api.post('/courses/', form);
        toast.show('Course created', 'success');
      }
      setForm(initial as Course);
      setEditingId(null);
      const refreshed = await data.fetchCourses();
      setCourses(refreshed || []);
    } catch (e) {
      toast.show('Failed to save course', 'error');
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm('Delete this course?')) return;
    try {
      await api.delete(`/courses/${id}/`);
      toast.show('Course deleted', 'success');
      // refresh list
      const c = await data.fetchCourses();
      setCourses(c || []);
    } catch (e) { toast.show('Failed to delete', 'error'); }
  };

  return (
    <div className="p-4">
      <h2 className="font-black text-lg mb-3">Courses</h2>

      <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Course ID</label>
          <input placeholder="e.g. CS-501" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} className="w-full px-3 py-2 border rounded" />
        </div>
        
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Course Name</label>
          <input placeholder="e.g. Fundamental Sciences" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded" />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Department(s)</label>
          <SearchableMultiSelect options={departments} value={form.department || []} onChange={(v) => setForm({ ...form, department: v } as Course)} placeholder="Select departments" />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={submit} className="px-4 py-2 bg-emerald-500 text-white rounded font-bold w-full">{editingId ? 'Save' : 'Create'}</button>
          {editingId && <button onClick={() => { setEditingId(null); setForm(initial as Course); }} className="px-3 py-2 border rounded w-full">Cancel</button>}
        </div>
      </div>

      <div className="bg-white rounded border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-sm text-slate-500 border-b bg-slate-50">
              <th className="py-3 px-4 font-bold">Course ID</th>
              <th className="py-3 px-4 font-bold">Name</th>
              <th className="py-3 px-4 font-bold">Department</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {courses.map(c => (
              <tr key={c.id} className="border-b hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 font-bold text-indigo-600">{c.course_id}</td>
                <td className="py-3 px-4 font-medium">{c.name}</td>
                <td className="py-3 px-4 text-slate-500">{(c.department || []).map((did: number) => departments.find(d => d.id === did)?.name || '—').join(', ')}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setEditingId(c.id); setForm(c); }} className="px-3 py-1 border rounded text-sm hover:bg-slate-100 font-medium">Edit</button>
                    <button onClick={() => onDelete(c.id)} className="px-3 py-1 border border-rose-200 bg-rose-50 rounded text-sm text-rose-600 hover:bg-rose-100 font-medium">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {courses.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">No courses found. Add one above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Courses;
