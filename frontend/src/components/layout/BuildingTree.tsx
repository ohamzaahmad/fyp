import React from 'react';
// Use DataProvider/masterMap instead of BUILDINGS constant fallback
import { Building, DoorOpen, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { MasterMap } from '../../types.ts';
import { useData } from '../../context/DataContext.tsx';

interface BuildingTreeProps {
  collapsedBuildings: Set<string>;
  onToggleBuilding: (id: string) => void;
  isSidebarCollapsed: boolean;
  masterMap?: NexusMasterMap;
  masterMap?: MasterMap;
}


interface RawBuilding {
  id: string;
  name: string;
  floors: any;
}

export const BuildingTree: React.FC<BuildingTreeProps> = ({ 
  collapsedBuildings, 
  onToggleBuilding,
  isSidebarCollapsed
  , masterMap
}) => {
  if (isSidebarCollapsed) return null;
  const data = useData();
  // Prefer DataProvider buildings when available, then prop masterMap, then demo BUILDINGS
  const buildingsSource: any[] = (data?.buildings && data.buildings.length > 0)
    ? data.buildings
    : (masterMap && Object.keys(masterMap).length > 0 ? Object.values(masterMap) : []);
  return (
    <div className="mt-8 px-3">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Building View</h3>
        <span className="text-[9px] font-bold text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">Total: {buildingsSource.length}</span>
      </div>

      <div className="space-y-2">
        {buildingsSource.map((building: any) => {
          const floorsArr = Array.isArray(building.floors) ? building.floors : Object.values(building.floors || {});
          const totalRooms = floorsArr.reduce((acc: number, f: any) => {
            if (Array.isArray(f.rooms)) return acc + f.rooms.length;
            return acc + Object.keys(f.rooms || {}).length;
          }, 0);
          const isCollapsed = collapsedBuildings.has(building.id);

          return (
            <div key={building.id} className="group">
              <button 
                onClick={() => onToggleBuilding(building.id)}
                className={cn(
                  "w-full flex items-center justify-between p-2 rounded transition-all",
                  isCollapsed ? "bg-slate-900/40 text-slate-500" : "bg-slate-900/80 text-white shadow-lg"
                )}
              >
                <div className="flex items-center gap-2">
                   <Building className={cn("w-3.5 h-3.5", isCollapsed ? "text-slate-600" : "text-emerald-500")} />
                   <span className="text-[11px] font-black uppercase tracking-tight">{building.name}</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-[9px] font-mono opacity-40">{totalRooms}R</span>
                   {isCollapsed ? <EyeOff className="w-3 h-3 opacity-40" /> : <Eye className="w-3 h-3 text-emerald-500" />}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
        <p className="text-[9px] font-medium text-emerald-500/80 leading-relaxed">
          <span className="font-black text-emerald-500 uppercase">Pro Tip:</span> Toggle buildings to speed up your scheduling workflow.
        </p>
      </div>
    </div>
  );
};
