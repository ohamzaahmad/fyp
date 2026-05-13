import React, { useEffect, useState } from 'react';
import * as api from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';

type RoomItem = {
  id: number;
  name: string;
  capacity: number;
  room_type: string;
  floor: number;
};

const Classrooms: React.FC = () => {
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [masterMap, setMasterMap] = useState<any>({});
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', capacity: 30, room_type: 'Lec', floorPk: 0 });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [roomTypes, setRoomTypes] = useState<{ code: string; name: string }[]>([]);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const m = await api.getMasterTimetable();
      setMasterMap(m || {});
      const r = await api.fetchRooms();
      setRooms(r || []);
      try {
        const rt = await api.fetchRoomTypes();
        // normalize response
        const norm = rt.map((t: any) => (typeof t === 'string' ? { code: t, name: t } : { code: t.code || t.label || t.name, name: t.name || t.label || t.code }));
        setRoomTypes(norm);
      } catch (e) {
        // ignore room types loading error
      }
    } catch (e) { toast.show('Failed to load rooms or master map', 'error'); }
  };

  const buildingList = Object.values(masterMap || {}).map((b: any) => ({ key: b.id, name: b.name, floors: b.floors }));

  const floorOptionsForBuilding = (bkey: string | null) => {
    if (!bkey) return [];
    const b = masterMap[bkey];
    if (!b) return [];
    return Object.values(b.floors).map((f: any) => ({ key: f.id, number: f.number }));
  };

  const pickFloorPk = (fkey: string | null) => {
    if (!fkey) return 0;
    // fkey example: 'floor-12'
    const parts = (fkey || '').split('-');
    return Number(parts[1] || 0);
  };

  const submit = async () => {
    try {
      const payload: any = { name: form.name, capacity: form.capacity, room_type: form.room_type, floor: form.floorPk };
      if (editingId) {
        await api.updateRoom(editingId, payload);
        toast.show('Room updated', 'success');
      } else {
        await api.createRoom(payload);
        toast.show('Room created', 'success');
      }
      setForm({ name: '', capacity: 30, room_type: 'Lec', floorPk: 0 });
      setEditingId(null);
      await load();
    } catch (e) { toast.show('Failed to save room', 'error'); }
  };

  const onEdit = (r: any) => {
    setEditingId(r.id);
    setForm({ name: r.name, capacity: r.capacity, room_type: r.room_type, floorPk: r.floor });
  };

  const onDelete = async (id: number) => {
    if (!confirm('Delete this room?')) return;
    try { await api.deleteRoom(id); toast.show('Room deleted', 'success'); await load(); } catch (e) { toast.show('Failed to delete', 'error'); }
  };

  return (
    <div className="p-4">
      <h2 className="font-black text-lg mb-3">Classrooms</h2>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <select value={selectedBuilding || ''} onChange={(e) => { setSelectedBuilding(e.target.value || null); setSelectedFloor(null); }} className="px-3 py-2 border rounded">
          <option value="">-- Select Building --</option>
          {Object.keys(masterMap || {}).map((k) => (
            <option key={k} value={k}>{masterMap[k].name}</option>
          ))}
        </select>

        <select value={selectedFloor || ''} onChange={(e) => { setSelectedFloor(e.target.value || null); setForm({ ...form, floorPk: pickFloorPk(e.target.value || null) }); }} className="px-3 py-2 border rounded">
          <option value="">-- Select Floor --</option>
          {selectedBuilding && Object.keys(masterMap[selectedBuilding].floors).map((fk) => (
            <option key={fk} value={fk}>{masterMap[selectedBuilding].floors[fk].number}</option>
          ))}
        </select>

        <input placeholder="Room name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border rounded" />

        <input type="number" min={1} placeholder="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="px-3 py-2 border rounded" />

        <select value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })} className="px-3 py-2 border rounded">
          {roomTypes.length === 0 ? (
            <>
              <option value="Lec">Lecture</option>
              <option value="Lab">Laboratory</option>
            </>
          ) : (
            roomTypes.map(rt => <option key={rt.code} value={rt.code}>{rt.name}</option>)
          )}
        </select>

        <div className="flex items-center gap-2">
          <button onClick={submit} className="px-4 py-2 bg-emerald-500 text-white rounded font-bold">{editingId ? 'Save' : 'Create'}</button>
          {editingId && <button onClick={() => { setEditingId(null); setForm({ name: '', capacity: 30, room_type: 'Lec', floorPk: 0 }); }} className="px-3 py-2 border rounded">Cancel</button>}
        </div>
      </div>

      <div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-sm text-slate-500 border-b"><th className="py-2">Building</th><th>Floor</th><th>Room</th><th>Capacity</th><th>Type</th><th></th></tr>
          </thead>
          <tbody>
            {rooms.map(r => {
              // find building/floor for floor pk
              const floorKey = Object.keys(masterMap || {}).flatMap(bk => Object.keys(masterMap[bk].floors).map(fk => ({ bk, fk }))).find(x => Number(x.fk.split('-')[1]) === r.floor);
              const buildingName = floorKey ? masterMap[floorKey.bk].name : '—';
              const floorNumber = floorKey ? masterMap[floorKey.bk].floors[floorKey.fk].number : '—';

              return (
                <tr key={r.id} className="border-b hover:bg-slate-50">
                  <td className="py-2 px-2">{buildingName}</td>
                  <td className="py-2 px-2">{floorNumber}</td>
                  <td className="py-2 px-2">{r.name}</td>
                  <td className="py-2 px-2">{r.capacity}</td>
                  <td className="py-2 px-2">{r.room_type}</td>
                  <td className="py-2 px-2">
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(r)} className="px-2 py-1 border rounded text-sm">Edit</button>
                      <button onClick={() => onDelete(r.id)} className="px-2 py-1 border rounded text-sm text-rose-600">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Classrooms;
