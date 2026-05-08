import React from 'react';
import { 
  LayoutDashboard, 
  CalendarRange, 
  Users, 
  GraduationCap, 
  Settings, 
  FileUp, 
  ChevronLeft, 
  ChevronRight,
  Zap,
  User,
  LogOut
} from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { UserRole } from '../../services/authService.ts';
import { NexusMasterMap } from '../../types.ts';

import { BuildingTree } from './BuildingTree.tsx';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: any) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  collapsedBuildings: Set<string>;
  onToggleBuilding: (id: string) => void;
  masterMap?: NexusMasterMap;
}

const NAV_ITEMS: { id: string; label: string; icon: any; roles?: UserRole[] }[] = [
  { id: 'dashboard', label: 'Analytics Core', icon: LayoutDashboard, roles: ['ADMIN', 'TEACHER'] },
  { id: 'timetable', label: 'Master Map', icon: CalendarRange, roles: ['ADMIN', 'TEACHER'] },
  { id: 'faculty', label: 'Faculty Registry', icon: Users, roles: ['ADMIN'] },
  { id: 'teacher', label: 'Teacher Portal', icon: User, roles: ['TEACHER', 'ADMIN'] },
  { id: 'rooms', label: 'Bulk Ingest', icon: FileUp, roles: ['ADMIN'] },
  { id: 'student', label: 'Batch Diagnostic', icon: GraduationCap },
  { id: 'export', label: 'UAF Official Print', icon: CalendarRange, roles: ['ADMIN'] },
  { id: 'settings', label: 'System Config', icon: Settings, roles: ['ADMIN'] },
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onViewChange, 
  isCollapsed, 
  setIsCollapsed,
  collapsedBuildings,
  onToggleBuilding 
}) => {
  const { user, logout, isAuthenticated } = useAuth();

  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (!item.roles) return true; // Public items (Student View)
    if (!isAuthenticated) return false;
    return item.roles.includes(user?.role || 'STUDENT');
  });

  return (
    <aside 
      className={cn(
        "h-screen bg-slate-950 text-slate-400 flex flex-col transition-all duration-300 border-r border-slate-800 shadow-xl",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="p-4 flex items-center justify-between border-b border-slate-800 h-14 bg-slate-900/50">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg shadow-lg shadow-emerald-900/20">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-bold text-white tracking-tighter text-base">NexusTime <span className="text-emerald-500">AI</span></span>
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-1.5 hover:bg-slate-800 rounded transition-colors",
            isCollapsed ? "mx-auto" : ""
          )}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded transition-all group",
              currentView === item.id 
                ? "bg-slate-800 text-emerald-400 border border-slate-700" 
                : "hover:bg-slate-800/50 hover:text-slate-200"
            )}
          >
            <item.icon className={cn(
              "w-4 h-4 shrink-0",
              currentView === item.id ? "text-emerald-400" : "group-hover:text-slate-200"
            )} />
            {!isCollapsed && (
              <span className="text-xs font-bold uppercase tracking-widest leading-none">{item.label}</span>
            )}
          </button>
        ))}

        {currentView === 'timetable' && user?.role === 'ADMIN' && (
          <BuildingTree 
            isSidebarCollapsed={isCollapsed}
            collapsedBuildings={collapsedBuildings}
            onToggleBuilding={onToggleBuilding}
            masterMap={masterMap}
          />
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900/20">
        {!isCollapsed && user ? (
          <div className="flex items-center gap-3 bg-slate-800/30 p-2 rounded border border-slate-700/50 group">
            <div className="w-7 h-7 rounded bg-emerald-500/10 flex items-center justify-center text-[10px] font-black text-emerald-500">
              {user.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-200 uppercase tracking-tighter truncate">{user.name}</p>
              <p className="text-[9px] font-bold text-slate-500 uppercase truncate tracking-widest">{user.role}</p>
            </div>
            <button 
              onClick={logout}
              className="p-1 hover:bg-rose-500/10 hover:text-rose-500 rounded transition-colors"
              title="Logout"
            >
               <LogOut className="w-3 h-3" />
            </button>
          </div>
        ) : !isCollapsed && (
          <button 
            onClick={() => window.location.hash = '#login'}
            className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-500 text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all"
          >
            Portal Entry
          </button>
        )}
      </div>
    </aside>
  );
};
