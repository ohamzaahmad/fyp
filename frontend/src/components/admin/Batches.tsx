import React, { useEffect, useState } from 'react';
import * as api from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';
import { Batch } from '../../types.ts';

const initial: Partial<Batch> = { subject_code: '', subject_name: '', batch_id: '', teacher: 0, weekly_hours: 3 };

const Batches: React.FC = () => {
  const [loads, setLoads] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [form, setForm] = useState<Batch>(initial as Batch);
  const [editingId, setEditingId] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const t = await api.fetchTeachers();
      setTeachers(t || []);
      const cls = await api.fetchBatches();
      setLoads(cls || []);
    } catch (e) {
      toast.show('Failed to load batches or teachers', 'error');
    }
  };

  const submit = async () => {
    try {
      const payload = {
        subject_code: form.subject_code,
        subject_name: form.subject_name,
        batch_id: form.batch_id,
        // Backend expects `faculty` FK; prefer UI `teacher` field then fall back to legacy `faculty`.
        faculty: (form as any).teacher || (form as any).faculty || null,
        weekly_hours: form.weekly_hours,
      };
      if (editingId) {
        await api.updateBatch(editingId, payload);
        toast.show('Batch updated', 'success');
      } else {
        await api.createBatch(payload);
        toast.show('Batch created', 'success');
      }
      setForm(initial as Batch);
      setEditingId(null);
      await load();
    } catch (e) {
      toast.show('Failed to save batch', 'error');
    }
  };

  const onEdit = (c: Batch) => {
    setEditingId(c.id);
    setForm(c);
  };

  const onDelete = async (id: number) => {
    if (!confirm('Delete this batch?')) return;
    try {
      await api.deleteBatch(id);
      toast.show('Batch deleted', 'success');
      await load();
    } catch (e) { toast.show('Failed to delete', 'error'); }
  };

  return (
    <div className="p-4">
      <h2 className="font-black text-lg mb-3">Batches</h2>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <input placeholder="Batch ID" value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })} className="px-3 py-2 border rounded" />
        <input placeholder="Subject Code" value={form.subject_code} onChange={(e) => setForm({ ...form, subject_code: e.target.value })} className="px-3 py-2 border rounded" />
        <input placeholder="Subject Name" value={form.subject_name} onChange={(e) => setForm({ ...form, subject_name: e.target.value })} className="px-3 py-2 border rounded" />
        <select value={(form as any).teacher || ''} onChange={(e) => setForm({ ...form, teacher: e.target.value ? Number(e.target.value) : 0 })} className="px-3 py-2 border rounded">
          <option value="">-- Teacher (optional) --</option>
          {teachers.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
        </select>
        <input type="number" min={1} placeholder="Weekly hours" value={form.weekly_hours} onChange={(e) => setForm({ ...form, weekly_hours: Number(e.target.value) })} className="px-3 py-2 border rounded" />
        <div className="flex items-center gap-2">
          <button onClick={submit} className="px-4 py-2 bg-emerald-500 text-white rounded font-bold">{editingId ? 'Save' : 'Create'}</button>
          {editingId && <button onClick={() => { setEditingId(null); setForm(initial as CourseLoad); }} className="px-3 py-2 border rounded">Cancel</button>}
        </div>
      </div>

      <div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-sm text-slate-500 border-b"><th className="py-2">Batch</th><th>Subject</th><th>Teacher</th><th>Hours</th><th></th></tr>
          </thead>
          <tbody>
            {loads.map(l => (
              <tr key={l.id} className="border-b hover:bg-slate-50">
                <td className="py-2 px-2 font-bold">{l.batch_id}</td>
                <td className="py-2 px-2">{l.subject_code} — {l.subject_name}</td>
                <td className="py-2 px-2">{teachers.find(t => String(t.id) === String((l as any).teacher || l.faculty))?.name || '—'}</td>
                <td className="py-2 px-2">{l.weekly_hours}</td>
                <td className="py-2 px-2">
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(l)} className="px-2 py-1 border rounded text-sm">Edit</button>
                    <button onClick={() => onDelete(l.id)} className="px-2 py-1 border rounded text-sm text-rose-600">Delete</button>
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
