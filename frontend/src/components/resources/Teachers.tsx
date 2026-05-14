import React, { useEffect, useState } from 'react';
import api from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';
import { Teacher, Department, Course } from '../../types.ts';
import { useData } from '../../context/DataContext.tsx';

const initial: Partial<Teacher> = { name: '', email: '', department: 0, tier: 3, can_teach: [], requested_slots: [] };

// Small tag-input for preferred times
const TagInput: React.FC<{ value?: string[]; onChange: (v: string[]) => void; placeholder?: string }> = ({ value = [], onChange, placeholder }) => {
  const [text, setText] = React.useState('');
  const add = (t: string) => {
    const v = t.trim();
    if (!v) return;
    if (value.includes(v)) return;
    onChange([...value, v]);
    setText('');
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-2">
        {value.map((t, i) => (
          <span key={i} className="px-2 py-0.5 bg-slate-100 rounded text-xs flex items-center gap-2">
            {t}
            <button onClick={() => remove(i)} className="text-rose-500 text-xs">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(text); } }} placeholder={placeholder || 'e.g. 08:00'} className="px-3 py-2 border rounded w-full" />
        <button onClick={() => add(text)} className="px-3 py-2 bg-emerald-500 text-white rounded">Add</button>
      </div>
    </div>
  );
};

const Teachers: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState<Teacher>(initial as Teacher);
  const [editingId, setEditingId] = useState<number | null>(null);
  const toast = useToast();

  const data = useData();
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [t, d, c] = await Promise.all([data.fetchTeachers(), data.fetchDepartments(), data.fetchCourses()]);
        if (!mounted) return;
        setTeachers(t || []);
        setDepartments(d || []);
        setCourses(c || []);
      } catch (e) {
        toast.show('Failed to load data', 'error');
      }
    })();
    return () => { mounted = false; };
  }, [data.fetchTeachers, data.fetchDepartments, data.fetchCourses]);

  const submit = async () => {
    if (!form.name || !form.email || !form.department) {
      toast.show('Please fill name, email, and department', 'error');
      return;
    }
    try {
      if (editingId) {
        await api.patch(`/faculties/${editingId}/`, form);
        toast.show('Teacher updated', 'success');
      } else {
        await api.post('/faculties/', form);
        toast.show('Teacher created', 'success');
      }
      setForm(initial as Teacher);
      setEditingId(null);
        const refreshed = await data.fetchTeachers();
        setTeachers(refreshed || []);
    } catch (e) {
      toast.show('Failed to save teacher', 'error');
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm('Delete this teacher?')) return;
    try {
      await api.delete(`/faculties/${id}/`);
      toast.show('Teacher deleted', 'success');
        const refreshed = await data.fetchTeachers();
        setTeachers(refreshed || []);
    } catch (e) { toast.show('Failed to delete', 'error'); }
  };

  const handleCourseToggle = (courseId: number) => {
    const current = Array.isArray(form.can_teach) ? form.can_teach.map(Number) : [];
    if (current.includes(courseId)) {
      setForm({ ...form, can_teach: current.filter(id => id !== courseId) });
    } else {
      setForm({ ...form, can_teach: [...current, courseId] });
    }
  };

  return (
    <div className="p-4">
      <h2 className="font-black text-lg mb-3">Faculty / Teachers</h2>

      <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">{editingId ? 'Edit Teacher' : 'Add New Teacher'}</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Teacher Name</label>
              <input placeholder="e.g. Ms. Nimra Razzaq" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
              <input type="email" placeholder="nimra@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded" />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Department</label>
                  <select value={form.department || ''} onChange={(e) => setForm({ ...form, department: Number(e.target.value) })} className="w-full px-3 py-2 border rounded">
                    <option value="">-- Select Dept --</option>
                    {departments.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                  </select>
                </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Tier / Seniority</label>
                <select value={form.tier || 3} onChange={(e) => setForm({ ...form, tier: Number(e.target.value) })} className="w-full px-3 py-2 border rounded">
                  <option value={1}>Tier 1 (Senior)</option>
                  <option value={2}>Tier 2 (Mid)</option>
                  <option value={3}>Tier 3 (Junior)</option>
                </select>
              </div>
            </div>

              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-500 mb-1">Preferred Times (press Enter or Add)</label>
                <TagInput value={Array.isArray(form.requested_slots) ? form.requested_slots : []} onChange={(v) => setForm({ ...form, requested_slots: v } as Teacher)} placeholder="HH:MM" />
              </div>
          </div>

          <div className="bg-white p-3 rounded border h-full">
            <label className="block text-xs font-bold text-slate-500 mb-2">Can Teach Courses (Select multiple)</label>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {courses.filter(c => {
                if (!form.department) return true;
                const deptField = (c as any).department;
                if (Array.isArray(deptField)) return deptField.map(Number).includes(Number(form.department));
                return Number(deptField) === Number(form.department);
              }).map(course => {
                const isSelected = Array.isArray(form.can_teach) && form.can_teach.map(Number).includes(course.id);
                return (
                  <label key={course.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer border border-transparent hover:border-slate-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => handleCourseToggle(course.id)}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <span className="text-sm font-medium">{course.course_id} - {course.name}</span>
                  </label>
                );
              })}
              {courses.length === 0 && <p className="text-xs text-slate-400">No courses available.</p>}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2 justify-end">
          {editingId && <button onClick={() => { setEditingId(null); setForm(initial as Teacher); }} className="px-4 py-2 border bg-white rounded font-medium">Cancel</button>}
          <button onClick={submit} className="px-6 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700">{editingId ? 'Save Changes' : 'Create Teacher'}</button>
        </div>
      </div>

      <div className="bg-white rounded border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-sm text-slate-500 border-b bg-slate-50">
              <th className="py-3 px-4 font-bold">Name</th>
              <th className="py-3 px-4 font-bold">Email</th>
              <th className="py-3 px-4 font-bold">Department</th>
              <th className="py-3 px-4 font-bold">Tier</th>
              <th className="py-3 px-4 font-bold">Courses Can Teach</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {teachers.map(t => (
              <tr key={t.id} className="border-b hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 font-bold text-slate-800">{t.name}</td>
                <td className="py-3 px-4 text-sm text-slate-500">{t.email}</td>
                <td className="py-3 px-4 text-sm text-slate-600">{departments.find(d => d.id === t.department)?.name || '—'}</td>
                <td className="py-3 px-4 text-sm">Tier {t.tier}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(t.can_teach) ? t.can_teach : []).slice(0, 3).map(cid => {
                      const c = courses.find(course => course.id === Number(cid));
                      return c ? <span key={cid} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">{c.course_id}</span> : null;
                    })}
                    {(Array.isArray(t.can_teach) ? t.can_teach : []).length > 3 && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold">+{t.can_teach.length - 3} more</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(t.requested_slots) ? t.requested_slots : []).map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">{s}</span>
                    ))}
                    {(!(Array.isArray(t.requested_slots) ? t.requested_slots : []).length) && <span className="text-xs text-slate-400">—</span>}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setEditingId(t.id); setForm(t); }} className="px-3 py-1 border rounded text-sm hover:bg-slate-100 font-medium">Edit</button>
                    <button onClick={() => onDelete(t.id)} className="px-3 py-1 border border-rose-200 bg-rose-50 rounded text-sm text-rose-600 hover:bg-rose-100 font-medium">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">No teachers found. Add one above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Teachers;
