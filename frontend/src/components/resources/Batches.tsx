import React, { useEffect, useState } from 'react';
import api from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';
import { Batch, Department, Course, Teacher } from '../../types.ts';
import { useData } from '../../context/DataContext.tsx';

const initial: Partial<Batch> = { name: '', department: 0, semester: 1, shift: 'M', courses: [] };

const Batches: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState<Batch>(initial as Batch);
  const [editingId, setEditingId] = useState<number | null>(null);
  const toast = useToast();

  const data = useData();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [b, d, c] = await Promise.all([
          data.fetchBatches(),
          data.fetchDepartments(),
          data.fetchCourses()
        ]);
        if (!mounted) return;
        setBatches(b || []);
        setDepartments(d || []);
        setCourses(c || []);
      } catch (e) {
        toast.show('Failed to load batches or departments', 'error');
      }
    })();
    return () => { mounted = false; };
  }, [data.fetchBatches, data.fetchDepartments, data.fetchCourses]);

  const submit = async () => {
    try {
      if (editingId) {
        await api.put(`/batches/${editingId}/`, form);
        toast.show('Batch updated', 'success');
      } else {
        await api.post('/batches/', form);
        toast.show('Batch created', 'success');
      }
      setForm(initial as Batch);
      setEditingId(null);
      const refreshed = await data.fetchBatches();
      setBatches(refreshed || []);
    } catch (e) {
      toast.show('Failed to save batch', 'error');
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm('Delete this batch?')) return;
    try {
      await api.delete(`/batches/${id}/`);
      toast.show('Batch deleted', 'success');
      const refreshed = await data.fetchBatches();
      setBatches(refreshed || []);
    } catch (e) { toast.show('Failed to delete', 'error'); }
  };

  const handleCourseToggle = (courseId: number) => {
    const current = Array.isArray(form.courses) ? form.courses.map(Number) : [];
    if (current.includes(courseId)) {
      setForm({ ...form, courses: current.filter(id => id !== courseId) });
    } else {
      setForm({ ...form, courses: [...current, courseId] });
    }
  };

  return (
    <div className="p-4">
      <h2 className="font-black text-lg mb-3">Batches</h2>

      <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">{editingId ? 'Edit Batch' : 'Add New Batch'}</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Batch Name</label>
              <input placeholder="e.g. BSSE-2023-A" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Department</label>
              <select value={form.department || ''} onChange={(e) => setForm({ ...form, department: Number(e.target.value) })} className="w-full px-3 py-2 border rounded">
                <option value="">-- Select Dept --</option>
                {departments.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Semester</label>
                <input type="number" placeholder="Semester" value={form.semester} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Shift</label>
                <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value as 'M' | 'E' })} className="w-full px-3 py-2 border rounded">
                  <option value="M">Morning</option>
                  <option value="E">Evening</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white p-3 rounded border h-full">
            <label className="block text-xs font-bold text-slate-500 mb-2">Courses (Select multiple)</label>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {courses.filter(c => {
                if (!form.department) return true;
                const deptField = (c as any).department;
                if (Array.isArray(deptField)) return deptField.map(Number).includes(Number(form.department));
                return Number(deptField) === Number(form.department);
              }).map(course => {
                const isSelected = Array.isArray(form.courses) && form.courses.map(Number).includes(course.id);
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
          {editingId && <button onClick={() => { setEditingId(null); setForm(initial as Batch); }} className="px-4 py-2 border bg-white rounded font-medium">Cancel</button>}
          <button onClick={submit} className="px-6 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700">{editingId ? 'Save Changes' : 'Create Batch'}</button>
        </div>
      </div>

      <div>
        <table className="w-full text-left border-collapse">
          <thead>
              <tr className="text-sm text-slate-500 border-b bg-slate-50"><th className="py-3 px-4 font-bold">Name</th><th className="py-3 px-4 font-bold">Department</th><th className="py-3 px-4 font-bold">Semester</th><th className="py-3 px-4 font-bold">Shift</th><th className="py-3 px-4 font-bold">Courses</th><th className="py-3 px-4"></th></tr>
          </thead>
          <tbody>
            {batches.map(b => (
              <tr key={b.id} className="border-b hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 font-bold text-slate-800">{b.name}</td>
                <td className="py-3 px-4 text-slate-600">{departments.find(d => d.id === b.department)?.name || '—'}</td>
                <td className="py-3 px-4">Sem {b.semester}</td>
                <td className="py-3 px-4">{b.shift === 'M' ? 'Morning' : 'Evening'}</td>
                <td className="py-3 px-4 text-sm font-medium text-slate-500">{(Array.isArray(b.courses) ? b.courses : []).length} courses</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setEditingId(b.id); setForm(b); }} className="px-3 py-1 border rounded text-sm hover:bg-slate-100 font-medium">Edit</button>
                    <button onClick={() => onDelete(b.id)} className="px-3 py-1 border border-rose-200 bg-rose-50 rounded text-sm text-rose-600 hover:bg-rose-100 font-medium">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Batches;
