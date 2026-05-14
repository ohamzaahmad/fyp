import React from 'react';
import { Building, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { MasterMap } from '../../types.ts';
import { useData } from '../../context/DataContext.tsx';

interface DepartmentTreeProps {
  collapsedBuildings: Set<string>;
  onToggleBuilding: (id: string) => void;
  isSidebarCollapsed: boolean;
  masterMap?: MasterMap;
}

export const DepartmentTree: React.FC<DepartmentTreeProps> = ({ 
  collapsedBuildings, 
  onToggleBuilding,
  isSidebarCollapsed,
  masterMap
}) => {
  if (isSidebarCollapsed) return null;
  const data = useData();
  
  const deptsSource: any[] = (data?.masterMap && Object.keys(data.masterMap).length > 0)
    ? Object.values(data.masterMap)
    : (masterMap && Object.keys(masterMap).length > 0 ? Object.values(masterMap) : []);

  return (
    <div className="mt-8 px-3">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Department View</h3>
        <span className="text-[9px] font-bold text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">Total: {deptsSource.length}</span>
      </div>

      <div className="space-y-2">
        {deptsSource.map((dept: any) => {
          const floorsArr = Object.values(dept.floors || {});
          const totalRooms = floorsArr.reduce((acc: number, f: any) => {
            return acc + Object.keys(f.rooms || {}).length;
          }, 0) as number;
          const isCollapsed = collapsedBuildings.has(dept.id);

          return (
            <div key={dept.id} className="group">
              <button 
                onClick={() => onToggleBuilding(dept.id)}
                className={cn(
                  "w-full flex items-center justify-between p-2 rounded transition-all",
                  isCollapsed ? "bg-slate-900/40 text-slate-500" : "bg-slate-900/80 text-white shadow-lg"
                )}
              >
                <div className="flex items-center gap-2">
                   <Building className={cn("w-3.5 h-3.5", isCollapsed ? "text-slate-600" : "text-emerald-500")} />
                   <span className="text-[11px] font-black uppercase tracking-tight truncate max-w-[120px]">{dept.name}</span>
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
          <span className="font-black text-emerald-500 uppercase">Pro Tip:</span> Toggle departments to speed up your scheduling workflow.
        </p>
      </div>
    </div>
  );
};
