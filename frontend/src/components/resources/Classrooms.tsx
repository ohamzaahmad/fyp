import React, { useEffect, useState } from 'react';
import api from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';
import { Department, Floor, Room } from '../../types.ts';
import { useData } from '../../context/DataContext.tsx';

const Classrooms: React.FC = () => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', capacity: 30, room_type: 'Lec', floor: 0 });
  const [editingId, setEditingId] = useState<number | null>(null);
  const toast = useToast();

  const data = useData();
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [d, r, f] = await Promise.all([data.fetchDepartments(), data.fetchRooms(), data.fetchFloors()]);
        if (!mounted) return;
        setDepartments(d || []);
        setRooms(r || []);
        setFloors(f || []);
      } catch (e) { toast.show('Failed to load classrooms', 'error'); }
    })();
    return () => { mounted = false; };
  }, [data.fetchDepartments, data.fetchRooms, data.fetchFloors]);

  const submit = async () => {
    try {
      if (editingId) {
        await api.patch(`/rooms/${editingId}/`, form);
        toast.show('Room updated', 'success');
      } else {
        await api.post('/rooms/', form);
        toast.show('Room created', 'success');
      }
      setForm({ name: '', capacity: 30, room_type: 'Lec', floor: 0 });
      setEditingId(null);
      const refreshed = await data.fetchRooms();
      setRooms(refreshed || []);
    } catch (e) { toast.show('Failed to save room', 'error'); }
  };

  const filteredFloors = floors.filter(f => f.department === selectedDept);

  return (
    <div className="p-4">
      <h2 className="font-black text-lg mb-3">Classrooms</h2>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <select value={selectedDept || ''} onChange={(e) => setSelectedDept(Number(e.target.value))} className="px-3 py-2 border rounded">
          <option value="">-- Department --</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select value={form.floor || ''} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })} className="px-3 py-2 border rounded">
          <option value="">-- Floor --</option>
          {filteredFloors.map((f) => (
            <option key={f.id} value={f.id}>Floor {f.number}</option>
          ))}
        </select>

        <input placeholder="Room name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border rounded" />
        <input type="number" min={1} placeholder="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="px-3 py-2 border rounded" />
        
        <select value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })} className="px-3 py-2 border rounded">
          <option value="Lec">Lecture</option>
          <option value="Lab">Laboratory</option>
        </select>

        <div className="flex items-center gap-2">
          <button onClick={submit} className="px-4 py-2 bg-emerald-500 text-white rounded font-bold">{editingId ? 'Save' : 'Create'}</button>
          {editingId && <button onClick={() => { setEditingId(null); setForm({ name: '', capacity: 30, room_type: 'Lec', floor: 0 }); }} className="px-3 py-2 border rounded">Cancel</button>}
        </div>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-sm text-slate-500 border-b"><th>Dept</th><th>Floor</th><th>Room</th><th>Cap</th><th>Type</th><th></th></tr>
        </thead>
        <tbody>
          {rooms.map(r => {
            const floor = floors.find(f => f.id === r.floor);
            const dept = departments.find(d => d.id === floor?.department);
            return (
              <tr key={r.id} className="border-b hover:bg-slate-50">
                <td className="py-2 px-2">{dept?.name || '—'}</td>
                <td className="py-2 px-2">{floor?.number ?? '—'}</td>
                <td className="py-2 px-2 font-bold">{r.name}</td>
                <td className="py-2 px-2">{r.capacity}</td>
                <td className="py-2 px-2 text-xs">{r.room_type}</td>
                <td className="py-2 px-2">
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingId(r.id); setForm({ name: r.name, capacity: r.capacity, room_type: r.room_type, floor: r.floor }); setSelectedDept(floor?.department); }} className="px-2 py-1 border rounded text-sm">Edit</button>
                    <button onClick={async () => { if(confirm('Delete?')) { await api.delete(`/rooms/${r.id}/`); const refreshed = await data.fetchRooms(); setRooms(refreshed || []); } }} className="px-2 py-1 border rounded text-sm text-rose-600">Delete</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default Classrooms;
