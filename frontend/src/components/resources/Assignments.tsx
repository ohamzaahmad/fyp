import React, { useEffect, useState } from 'react';
import api, * as apiMethods from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';
import { CourseAssignment, Course, Batch, Teacher } from '../../types.ts';

const initial: Partial<CourseAssignment> = { course: 0, batch: 0, teacher: 0, weekly_hours: 3, type: 'T' };

const Assignments: React.FC = () => {
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [form, setForm] = useState<CourseAssignment>(initial as CourseAssignment);
  const [editingId, setEditingId] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const a = await apiMethods.fetchAssignments();
      setAssignments(a || []);
      const c = await apiMethods.fetchCourses();
      setCourses(c || []);
      const b = await apiMethods.fetchBatches();
      setBatches(b || []);
      const t = await apiMethods.fetchTeachers();
      setTeachers(t || []);
    } catch (e) {
      toast.show('Failed to load data', 'error');
    }
  };

  const submit = async () => {
    if (!form.course || !form.batch || !form.teacher) {
      toast.show('Please fill all fields', 'error');
      return;
    }

    // Validation: Teacher must be able to teach the course
    const selectedTeacher = teachers.find(t => t.id === form.teacher);
    if (selectedTeacher) {
      const canTeach = Array.isArray(selectedTeacher.can_teach) ? selectedTeacher.can_teach.map(Number) : [];
      if (!canTeach.includes(Number(form.course))) {
        toast.show(`${selectedTeacher.name} is not specialized to teach this course! Please update their settings.`, 'error');
        return;
      }
    }

    try {
      if (editingId) {
        await api.patch(`/assignments/${editingId}/`, form);
        toast.show('Assignment updated', 'success');
      } else {
        await api.post('/assignments/', form);
        toast.show('Assignment created', 'success');
      }
      setForm(initial as CourseAssignment);
      setEditingId(null);
      await load();
    } catch (e) {
      toast.show('Failed to save assignment', 'error');
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm('Delete this assignment?')) return;
    try {
      await api.delete(`/assignments/${id}/`);
      toast.show('Assignment deleted', 'success');
      await load();
    } catch (e) { toast.show('Failed to delete', 'error'); }
  };

  return (
    <div className="p-4">
      <h2 className="font-black text-lg mb-3">Course Assignments (Teacher -&gt; Course -&gt; Batch)</h2>

      <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">{editingId ? 'Edit Assignment' : 'Add New Assignment'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Course</label>
            <select value={form.course || ''} onChange={(e) => setForm({ ...form, course: Number(e.target.value) })} className="w-full px-3 py-2 border rounded">
              <option value="">-- Select Course --</option>
              {courses.map(c => (<option key={c.id} value={c.id}>{c.course_id} - {c.name}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Teacher</label>
            <select value={form.teacher || ''} onChange={(e) => setForm({ ...form, teacher: Number(e.target.value) })} className="w-full px-3 py-2 border rounded">
              <option value="">-- Select Teacher --</option>
              {teachers.map(t => {
                const canTeach = Array.isArray(t.can_teach) ? t.can_teach.map(Number) : [];
                const isSpecialized = form.course ? canTeach.includes(Number(form.course)) : true;
                return (
                  <option key={t.id} value={t.id} disabled={!isSpecialized}>
                    {t.name} {!isSpecialized && '(Not Specialized)'}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Batch</label>
            <select value={form.batch || ''} onChange={(e) => setForm({ ...form, batch: Number(e.target.value) })} className="w-full px-3 py-2 border rounded">
              <option value="">-- Select Batch --</option>
              {batches.map(b => {
                 // Optionally filter batches that have this course in their curriculum
                 const hasCourse = Array.isArray(b.courses) ? b.courses.map(Number).includes(Number(form.course)) : true;
                 return (
                  <option key={b.id} value={b.id} disabled={form.course ? !hasCourse : false}>
                    {b.name} {form.course && !hasCourse ? '(Course not in curriculum)' : ''}
                  </option>
                 );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Weekly Hours (Credits)</label>
            <input type="number" value={form.weekly_hours} onChange={(e) => setForm({ ...form, weekly_hours: Number(e.target.value) })} className="w-full px-3 py-2 border rounded" min="1" max="6" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'T' | 'P' })} className="w-full px-3 py-2 border rounded">
              <option value="T">Theory</option>
              <option value="P">Practical / Lab</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={submit} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold w-full">{editingId ? 'Save' : 'Create'}</button>
            {editingId && <button onClick={() => { setEditingId(null); setForm(initial as CourseAssignment); }} className="px-3 py-2 border rounded w-full bg-white">Cancel</button>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-sm text-slate-500 border-b bg-slate-50">
              <th className="py-3 px-4 font-bold">Course</th>
              <th className="py-3 px-4 font-bold">Teacher</th>
              <th className="py-3 px-4 font-bold">Batch</th>
              <th className="py-3 px-4 font-bold text-center">Hours</th>
              <th className="py-3 px-4 font-bold">Type</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => {
              const c = courses.find(x => x.id === a.course);
              const t = teachers.find(x => x.id === a.teacher);
              const b = batches.find(x => x.id === a.batch);
              return (
                <tr key={a.id} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-bold text-indigo-600">{c?.course_id || a.course}</td>
                  <td className="py-3 px-4 font-medium">{t?.name || a.teacher}</td>
                  <td className="py-3 px-4 text-slate-600">{b?.name || a.batch}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-500">{a.weekly_hours}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${a.type === 'P' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {a.type === 'P' ? 'Practical' : 'Theory'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditingId(a.id); setForm(a); }} className="px-3 py-1 border rounded text-sm hover:bg-slate-100 font-medium">Edit</button>
                      <button onClick={() => onDelete(a.id)} className="px-3 py-1 border border-rose-200 bg-rose-50 rounded text-sm text-rose-600 hover:bg-rose-100 font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {assignments.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">No assignments found. Add one above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Assignments;
