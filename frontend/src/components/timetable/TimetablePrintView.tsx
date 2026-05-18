import React from 'react';
import { useData } from '../../context/DataContext.tsx';
import { cn } from '../../lib/utils.ts';
import { TIME_SLOTS, getSlotRanges, parseTime } from '../../constants.ts';
import * as api from '../../services/api.ts';
import { ClassSession, Teacher } from '../../types.ts';

interface TimetablePrintViewProps {
  classes: ClassSession[];
}



export const TimetablePrintView: React.FC<TimetablePrintViewProps> = ({ classes }) => {
  const data = useData();
  const DAYS = data?.systemSettings?.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const [unmatched, setUnmatched] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!data?.masterMap || Object.keys(data.masterMap).length === 0) {
      data.refreshMasterMap?.();
    }
  }, [data.masterMap, data.refreshMasterMap]);

  const buildingsSource = data?.masterMap || {};
  const buildings = Object.values(buildingsSource);
  const slotRanges = React.useMemo(() => getSlotRanges(), []);

  // Detect entries whose room is not present in masterMap and mark them as unmatched
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const entries: any[] = await api.fetchEntries();
        const roomIds = new Set<string>();
        Object.values(buildingsSource || {}).forEach((building: any) => {
          Object.values(building.floors || {}).forEach((f: any) => {
            Object.values(f.rooms || {}).forEach((r: any) => {
              roomIds.add(String(r.id));
            });
          });
        });

        const unmatchedEntries = (entries || []).filter(e => {
          const rid = String(e.room ?? e.room_id ?? e.roomId ?? e.roomId ?? '');
          return rid && !roomIds.has(rid);
        });

        if (mounted) {
          setUnmatched(unmatchedEntries);
          if (unmatchedEntries.length > 0) console.warn('Unmatched sessions (room ids not found in masterMap):', unmatchedEntries);
        }
      } catch (err) {
        console.warn('Failed to fetch entries for unmatched detection', err);
      }
    })();
    return () => { mounted = false; };
  }, [buildingsSource]);

  const getSessionSlotInfo = (session: ClassSession) => {
    const startMin = parseTime(session.startTime);
    const endMin = startMin + (session.durationMinutes || 50);
    const startSlotIdx = slotRanges.findIndex(r => r && startMin >= r.start && startMin < r.end);
    if (startSlotIdx === -1) return null;

    let span = 0;
    for (let i = startSlotIdx; i < slotRanges.length; i++) {
      const r = slotRanges[i];
      if (r === null) {
        if (i + 1 < slotRanges.length && slotRanges[i + 1] && slotRanges[i + 1]!.start < endMin) {
          span++; 
        }
        continue;
      }
      if (r.start >= endMin) break;
      span++;
    }
    return { startSlotIdx, colSpan: Math.max(1, span) };
  };

  return (
    <div className="bg-white p-8 font-sans print:p-0 print:m-0" id="uaf-print-body">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: landscape; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; }
          #uaf-print-body { width: 100%; border: none; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}} />

      {/* Unmatched Sessions - Commented Out */}
      {/* 
      {unmatched.length > 0 && (
        <div className="mb-6 p-3 border-2 border-red-600 bg-red-50 text-red-800">
          <h2 className="font-bold text-lg">Unmatched Sessions ({unmatched.length})</h2>
          <ul className="text-xs mt-2">
            {unmatched.map((u, i) => (
              <li key={i} className="mb-1">
                <span className="font-semibold">Entry {u.id ?? u.pk ?? ''}</span>
                {' — room: '}<span className="inline-block px-1 bg-red-200 rounded">{String(u.room ?? u.room_id ?? u.roomId)}</span>
                {' — '}{u.start_time ?? u.startTime ?? u.start}
                {' — '}{u.day_of_week ?? u.day ?? ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      */}

      {buildings.map((building, bIdx) => {
        const rooms: any[] = [];
        Object.values(building.floors || {}).forEach((f: any) => {
          Object.values(f.rooms || {}).forEach((r: any) => {
            rooms.push({ ...r, buildingName: building.name, floorNum: f.number });
          });
        });

        if (rooms.length === 0) return null;

        return (
          <div key={bIdx} style={{ pageBreakAfter: 'always' }} className="mb-12 print:mb-0 print:block">
            <div className="text-center mb-6 border-2 border-black p-4">
              <h1 className="text-2xl font-bold uppercase">
                Time Table of Spring Semester 2026, Department of {building.name}, UAF
              </h1>
            </div>

            <table className="w-full border-collapse border-2 border-black text-[10px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1 w-12">Day</th>
                  <th className="border border-black p-1 w-28">Class Room</th>
                  {TIME_SLOTS.map((slot, sIdx) => (
                    <th
                      key={sIdx}
                      className={cn(
                        "border border-black p-1 text-center",
                        slot === 'Break' && "bg-slate-200 text-slate-500 italic"
                      )}
                    >
                      {slot === 'Break' ? '☕ Break' : slot}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => {
                  // Only include rooms that actually have sessions on this day to save space,
                  // or include all rooms if preferred. We'll include all to maintain structure.
                  const roomsWithData = rooms.filter(r => r.days && r.days[day] && r.days[day].length > 0);
                  // If no rooms have classes on this day, we can skip the day entirely to save paper.
                  if (roomsWithData.length === 0) return null;

                  return roomsWithData.map((room, rIdx) => {
                    const slotMap: Record<number, { session: any; colSpan: number; isStart: boolean }> = {};
                    
                    // Highly optimized: fetch directly from the nested hierarchy
                    const roomSessions = room.days[day] || [];

                    roomSessions.forEach((session: any) => {
                      const info = getSessionSlotInfo(session);
                      if (!info) return;
                      const { startSlotIdx, colSpan } = info;
                      slotMap[startSlotIdx] = { session, colSpan, isStart: true };
                      for (let i = 1; i < colSpan; i++) {
                        const sIdx = startSlotIdx + i;
                        if (sIdx < TIME_SLOTS.length) {
                          slotMap[sIdx] = { session, colSpan, isStart: false };
                        }
                      }
                    });

                    const teacher = (session: any) =>
                      session ? data?.teachers.find((t: Teacher) => String(t.id) === String(session.teacherId || session.facultyId)) : null;

                    return (
                      <tr key={`${day}-${room.id}`} className="border-b border-black">
                        <td className="border border-black p-1 text-center font-bold text-[10px] whitespace-nowrap">
                          {day}
                        </td>
                        <td className="border border-black p-1 font-bold text-center text-[9px] leading-tight whitespace-nowrap">
                          <div>{room.floorNum ? `Floor ${room.floorNum}` : room.buildingName}</div>
                          <div>{room.name}</div>
                        </td>

                        {TIME_SLOTS.map((slot, sIdx) => {
                          const entry = slotMap[sIdx];
                          if (entry && !entry.isStart) return null;
                          if (slot === 'Break') {
                            return <td key={sIdx} className="border border-black text-center text-[10px] font-bold text-slate-600">Break</td>;
                          }
                          if (!entry) {
                            return <td key={sIdx} className="border border-black p-1 text-center"></td>;
                          }

                          const { session, colSpan } = entry;
                          const t = teacher(session);
                          return (
                            <td key={sIdx} colSpan={colSpan} className="border border-black p-1 text-center align-middle">
                              <div className="flex flex-col items-center justify-center gap-0.5 leading-[1.1]">
                                <div className="font-bold text-[9px] text-black uppercase">{session.subjectCode}</div>
                                <div className="text-[8px] text-black">{session.batchId}</div>
                                {t && <div className="text-[8px] text-black whitespace-normal">{t.name}</div>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

export default TimetablePrintView;
