import React, { useEffect, useState } from 'react';
import api, * as apiMethods from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';
import { Course, Department } from '../../types.ts';

const initial: Partial<Course> = { course_id: '', name: '', department: 0 };

const Courses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<Course>(initial as Course);
  const [editingId, setEditingId] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const c = await apiMethods.fetchCourses();
      setCourses(c || []);
      const d = await apiMethods.fetchDepartments();
      setDepartments(d || []);
    } catch (e) {
      toast.show('Failed to load courses or departments', 'error');
    }
  };

  const submit = async () => {
    if (!form.course_id || !form.name || !form.department) {
      toast.show('Please fill all fields', 'error');
      return;
    }
    try {
      if (editingId) {
        await apiMethods.updateCourse(editingId, form);
        toast.show('Course updated', 'success');
      } else {
        await apiMethods.createCourse(form);
        toast.show('Course created', 'success');
      }
      setForm(initial as Course);
      setEditingId(null);
      await load();
    } catch (e) {
      toast.show('Failed to save course', 'error');
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm('Delete this course?')) return;
    try {
      await apiMethods.deleteCourse(id);
      toast.show('Course deleted', 'success');
      await load();
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
          <label className="block text-xs font-bold text-slate-500 mb-1">Department</label>
          <select value={form.department || ''} onChange={(e) => setForm({ ...form, department: Number(e.target.value) })} className="w-full px-3 py-2 border rounded">
            <option value="">-- Select Dept --</option>
            {departments.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
          </select>
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
                <td className="py-3 px-4 text-slate-500">{departments.find(d => d.id === c.department)?.name || '—'}</td>
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
