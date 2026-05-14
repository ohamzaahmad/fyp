import React from 'react';
import { useData } from '../../context/DataContext.tsx';
import { cn } from '../../lib/utils.ts';
import { TIME_SLOTS } from '../../constants.ts';
import { ClassSession, Teacher } from '../../types.ts';

interface TimetablePrintViewProps {
  classes: ClassSession[];
}

const parseTime = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const getSlotRanges = () => {
  // Convert TIME_SLOTS to start/end minutes for alignment
  return TIME_SLOTS.map(slot => {
    if (slot === 'Break') return null; // Handle break specially or skip
    const parts = slot.split('-');
    if (parts.length !== 2) return null;
    
    const parse = (t: string) => {
      const [hStr, mStr] = t.trim().split(':');
      let h = parseInt(hStr);
      const m = parseInt(mStr || '0');
      // If it's 1-7, assume PM (add 12)
      if (h >= 1 && h <= 7) h += 12;
      return h * 60 + m;
    };
    
    return { start: parse(parts[0]), end: parse(parts[1]), label: slot };
  });
};



export const TimetablePrintView: React.FC<TimetablePrintViewProps> = ({ classes }) => {
  const data = useData();
  const DAYS = data?.systemSettings?.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  React.useEffect(() => {
    if (!data?.masterMap || Object.keys(data.masterMap).length === 0) {
      data.refreshMasterMap?.();
    }
  }, [data.masterMap, data.refreshMasterMap]);

  const buildingsSource = data?.masterMap || {};
  const buildings = Object.values(buildingsSource);
  const slotRanges = React.useMemo(() => getSlotRanges(), []);

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
