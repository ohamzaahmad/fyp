import React from 'react';
import { 
  LayoutDashboard, 
  CalendarRange, 
  Users, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Zap,
  User,
  LogOut,
  Eye,
  EyeOff,
  Sparkles,
  Database,
  Wand2,
  PieChart
} from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { UserRole } from '../../services/authService.ts';
import { MasterMap } from '../../types.ts';
import { DepartmentTree } from './DepartmentTree.tsx';
import { useData } from '../../context/DataContext.tsx';
import ConfirmDialog from '../ui/ConfirmDialog.tsx';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: any) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  collapsedBuildings: Set<string>;
  onToggleBuilding: (id: string) => void;
  masterMap?: MasterMap;
  efficiency: number;
  onGenerate: () => void;
  className?: string;
}

const NAV_ITEMS: { id: string; label: string; icon: any; roles?: UserRole[] }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
  { id: 'timetable', label: 'Timetable', icon: CalendarRange, roles: ['ADMIN'] },
  { id: 'suggestions', label: 'Suggestions', icon: Sparkles, roles: ['ADMIN'] },
  { id: 'resources', label: 'Resources', icon: Database, roles: ['ADMIN'] },
  { id: 'schedule', label: 'My Schedule', icon: User, roles: ['TEACHER', 'ADMIN'] },
  { id: 'export', label: 'Print Timetable', icon: CalendarRange, roles: ['ADMIN'] },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onViewChange, 
  isCollapsed, 
  setIsCollapsed,
  collapsedBuildings,
  onToggleBuilding,
  masterMap,
  efficiency,
  onGenerate,
  className
}) => {
  const { user, logout, isAuthenticated } = useAuth();
  const data = useData();

  const appName = data.systemSettings?.app_name || 'NexusTime AI';
  // Attempt to split by space to highlight the second word (e.g. AI) if present
  const nameParts = appName.split(' ');
  const firstPart = nameParts[0];
  const restPart = nameParts.slice(1).join(' ');

  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (!item.roles) return true; 
    if (!isAuthenticated) return false;
    return item.roles.includes(user?.role || 'STUDENT');
  });

  return (
    <aside 
      className={cn(
        "h-screen bg-slate-950 text-slate-400 flex flex-col transition-all duration-300 border-r border-slate-800 shadow-xl",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
      data-tour="app-sidebar"
    >
      <div className="p-4 flex items-center justify-between border-b border-slate-800 h-14 bg-slate-900/50">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg">
              {data.systemSettings?.logo_url ? (
                <img src={data.systemSettings.logo_url} alt="Logo" className="w-8 h-8 object-contain" />
              ) : (
                <div className="bg-emerald-600 p-1.5 rounded-lg shadow-lg shadow-emerald-900/20">
                  <Zap className="w-4 h-4 text-white fill-white" />
                </div>
              )}
            </div>
            <span className="font-bold text-white tracking-tighter text-base">
              {firstPart} {restPart && <span className="text-emerald-500">{restPart}</span>}
            </span>
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
            data-tour-nav={item.id}
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
          <DepartmentTree 
            isSidebarCollapsed={isCollapsed}
            collapsedBuildings={collapsedBuildings}
            onToggleBuilding={onToggleBuilding}
            masterMap={masterMap}
          />
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900/20 space-y-4">
        {/* Efficiency & Generate - Only for ADMIN */}
        {!isCollapsed && user?.role === 'ADMIN' && (
          <div className="space-y-3">
             {/* <div className="flex items-center justify-between bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 relative flex items-center justify-center shrink-0">
                      <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
                      <div 
                        className="absolute inset-0 rounded-full border-2 border-emerald-500 transition-all duration-1000" 
                        style={{ 
                          clipPath: `inset(0 0 0 0)`,
                          background: `conic-gradient(#10b981 ${efficiency * 3.6}deg, transparent 0deg)` 
                        }} 
                      />
                      <span className="text-[10px] font-black text-white z-10">{efficiency}%</span>
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-slate-200 uppercase tracking-tighter">Plan Efficiency</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Global Optima</p>
                   </div>
                </div>
             </div> */}

             <ConfirmDialog
                trigger={
                  <button className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all active:scale-95 group" data-tour="generate-timetable">
                    <Wand2 className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                    Generate Timetable
                  </button>
                }
                title="Optimize Timetable"
                description="This will trigger the AI scheduling engine to reconstruct the timetable based on current constraints. This may take a few seconds. Proceed?"
                onConfirm={onGenerate}
             />
          </div>
        )}

        {isCollapsed && user?.role === 'ADMIN' && (
           <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 flex items-center justify-center text-[8px] font-black text-emerald-500" title={`Efficiency: ${efficiency}%`}>
                 {efficiency}
              </div>
           </div>
        )}

        {!isCollapsed && user ? (
            <div className="flex items-center gap-3 bg-slate-800/30 p-2 rounded border border-slate-700/50 group">
            <div className="w-7 h-7 rounded bg-emerald-500/10 flex items-center justify-center text-[10px] font-black text-emerald-500">
              {user.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-200 uppercase tracking-tighter truncate">{user.name}</p>
              <p className="text-[9px] font-bold text-slate-500 uppercase truncate tracking-widest">{user.role}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={logout}
                className="p-1 hover:bg-rose-500/10 hover:text-rose-500 rounded transition-colors"
                title="Logout"
              >
                 <LogOut className="w-3 h-3" />
              </button>
            </div>
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
