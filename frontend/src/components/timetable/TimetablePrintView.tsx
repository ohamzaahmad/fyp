import React from 'react';
import { ClassSession, Teacher } from '../../types.ts';
import { useData } from '../../context/DataContext.tsx';
import { cn } from '../../lib/utils.ts';

interface TimetablePrintViewProps {
  classes: ClassSession[];
}

const TIME_SLOTS = [
  '8:00 - 8:50', '8:50 - 9:40', '9:40 - 10:30', '10:30 - 11:20', '11:20 - 12:10', '12:10 - 1:00',
  'Break',
  '1:10 - 2:00', '2:00 - 2:50', '2:50 - 3:40', '3:40 - 4:30', '4:30 - 5:20', '5:20 - 6:10'
];

export const TimetablePrintView: React.FC<TimetablePrintViewProps> = ({ classes }) => {
  const data = useData();
  React.useEffect(() => {
    if (!data?.masterMap || Object.keys(data.masterMap).length === 0) {
      data.refreshMasterMap?.();
    }
  }, [data.masterMap, data.refreshMasterMap]);
  const sessions = data?.sessions || [];
  const buildingsSource = data?.masterMap || {};
  const buildings = Object.values(buildingsSource);

  // Precompute slot start/end in minutes (24-hour). We treat slots before the 'Break' as morning/noon
  // and slots after as afternoon (add 12 to hour when hour < 12).
  const BREAK_INDEX = TIME_SLOTS.indexOf('Break');
  const slotRanges = TIME_SLOTS.map((slot, idx) => {
    if (slot === 'Break') return null;
    const parts = slot.split('-').map(p => p.trim());
    const start = parts[0];
    const end = parts[1];
    const parse = (t: string) => {
      const [hStr, mStr] = t.split(':').map(s => s.trim());
      let h = Number(hStr);
      const m = Number(mStr || '0');
      if (idx > BREAK_INDEX && h < 12) h += 12;
      // special-case 12pm stays 12
      return h * 60 + m;
    };
    return { start: parse(start), end: parse(end) };
  });

  return (
    <div className="bg-white p-8 font-sans print:p-0 print:m-0" id="uaf-print-body">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: landscape; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; }
          #uaf-print-body { width: 100%; border: none; }
        }
      `}} />

      {buildings.map((building, bIdx) => {
        const rooms: any[] = [];
        Object.values(building.floors || {}).forEach(f => {
          Object.values(f.rooms || {}).forEach(r => {
            rooms.push({ ...r, buildingName: building.name, floorNum: f.number });
          });
        });

        if (rooms.length === 0) return null;

        return (
          <div key={bIdx} style={{ pageBreakAfter: 'always' }} className="mb-12 print:mb-0 print:block">
            <div className="text-center mb-6 border-2 border-black p-4">
              <h1 className="text-2xl font-bold uppercase">Time Table of Spring Semester 2026, Department of {building.name}, UAF</h1>
            </div>

            <table className="w-full border-collapse border-2 border-black text-[10px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1 w-12">Day</th>
                  <th className="border border-black p-1 w-24">Class Room</th>
                  {TIME_SLOTS.map(slot => (
                    <th key={slot} className={cn("border border-black p-1", slot === 'Break' && "bg-slate-200")}>
                      {slot}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room, idx) => (
                  <tr key={idx} className="h-16">
                    {idx === 0 && <td rowSpan={rooms.length} className="border border-black text-center font-bold rotate-180 [writing-mode:vertical-lr]">Mon</td>}
                    <td className="border border-black p-1 font-bold text-center bg-slate-50">
                      <div className="text-[8px] uppercase">{room.buildingName}</div>
                      <div className="text-[9px] leading-tight mt-1">{room.floorNum ? `Floor ${room.floorNum} · ` : ''}{room.name}</div>
                    </td>
                    {TIME_SLOTS.map((slot, sIdx) => {
                      if (slot === 'Break') return <td key={sIdx} className="border border-black bg-slate-100 text-center font-black animate-pulse">BREAK</td>;

                      const startHour = slot.split(':')[0];
                      // Match session whose startTime falls within this slot's range
                      const slotRange = slotRanges[sIdx];
                      let session: any = null;
                      if (slotRange) {
                        session = sessions.find(c => {
                          if (!c?.startTime) return false;
                          const [sh, sm] = (c.startTime || '').split(':').map(Number);
                          const minutes = (sh || 0) * 60 + (sm || 0);
                          return String(c.roomId) === String(room.id) && minutes >= slotRange.start && minutes < slotRange.end;
                        });
                      }
                      const teacher = session ? data?.teachers.find((t: Teacher) => String(t.id) === String(session.teacherId || session.facultyId)) : null;

                      return (
                        <td key={sIdx} className="border border-black p-1 text-center relative">
                          {session ? (
                            <div className="flex flex-col justify-center h-full">
                              <div className="font-bold">{session.subjectCode}</div>
                              <div className="text-[8px]">{session.batchId}</div>
                              <div className="text-[8px] italic">{teacher?.name}</div>
                            </div>
                          ) : (
                            <div className="text-slate-200">-</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-8 flex justify-between text-[10px] font-bold">
              <span>Generated by NexusTime AI</span>
              <span>Authentication ID: PROD_UAF_S26</span>
              <div className="border-t border-black px-12 pt-1">Administrative Authority Signature</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TimetablePrintView;
