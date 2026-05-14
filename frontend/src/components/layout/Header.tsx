import React, { useEffect, useState } from 'react';
import { Search, Bell, HelpCircle } from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { cn } from '../../lib/utils.ts';
import { Button } from '../ui/Button.tsx';
import Avatar from '../ui/Avatar.tsx';
import DropdownMenu from '../ui/DropdownMenu.tsx';
import Popover from '../ui/Popover.tsx';
import ConfirmDialog from '../ui/ConfirmDialog.tsx';
import { useToast } from '../ui/Toast.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { generateSchedule } from '../../services/api.ts';

interface HeaderProps {
  selectedDepts: number[];
  setSelectedDepts: (depts: number[]) => void;
  efficiency: number;
}

export const Header: React.FC<HeaderProps> = ({ 
  selectedDepts, 
  setSelectedDepts, 
  efficiency 
}) => {
  const data = useData();
  const [query, setQuery] = useState('');
  const departments = data?.departments || [];

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const matches = departments.filter(d => d.name.toLowerCase().includes(query.toLowerCase()));
      if (matches.length > 0) {
        setSelectedDepts(matches.map(d => d.id));
      }
      setQuery('');
    }
  };

  const handleDeptToggle = (deptId: number) => {
    if (selectedDepts.includes(deptId)) {
      setSelectedDepts(selectedDepts.filter(id => id !== deptId));
    } else {
      setSelectedDepts([...selectedDepts, deptId]);
    }
  };

  const toast = useToast();
  const { logout } = useAuth();

  const menuItems = [
    { label: 'Profile', onSelect: () => { try { toast.show('Profile clicked', 'info'); } catch(_){} } },
    { label: 'Settings', onSelect: () => window.dispatchEvent(new CustomEvent('nexus:open-settings')) },
    { label: 'Logout', onSelect: () => { logout(); try { toast.show('Logged out', 'info'); } catch(_){} } },
  ];

  const visibleDepts = departments.slice(0, 6);
  const extraDepts = departments.slice(6);

  const renderDonut = (v: number) => (
    <div className="w-10 h-10 relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#059669 ${v * 3.6}deg, #f1f5f9 0deg)` }} />
      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[11px] font-black text-slate-700">{v}</div>
    </div>
  );

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-6 flex-1">
        <div className="flex items-center gap-3 mr-3">
          <div className="w-9 h-9 bg-emerald-600 rounded-md flex items-center justify-center text-white font-black">N</div>
          <div>
            <div className="text-sm font-black">Nexus</div>
            <div className="text-[10px] text-slate-400 -mt-0.5">Timetable</div>
          </div>
        </div>

        <div className="relative group flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="Search Departments..." 
            className="w-full bg-slate-100 border border-transparent rounded-xl px-4 py-2 pl-10 text-sm focus:outline-none focus:bg-white focus:border-slate-300 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {visibleDepts.map((dept) => (
            <button
              key={dept.id}
              onClick={() => handleDeptToggle(dept.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all border",
                selectedDepts.includes(dept.id)
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-md"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              {dept.code}
            </button>
          ))}
          {extraDepts.length > 0 && (
            <div className="flex items-center">
              <DropdownMenu trigger={<button className="px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200">+{extraDepts.length}</button>} items={extraDepts.map(d => ({ label: d.code, onSelect: () => handleDeptToggle(d.id) }))} />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="relative">{renderDonut(efficiency)}</div>
          <ConfirmDialog
            trigger={<Button className="flex items-center gap-2 px-4 py-2">Generate Optimized</Button>}
            title="Run Optimization"
            description="This will enqueue the optimizer job in the background. Proceed?"
            onConfirm={async () => {
              try {
                await generateSchedule();
                toast.show('Optimization started', 'success');
              } catch (err) {
                toast.show('Failed to start optimization', 'error');
              }
            }}
          />

          <Popover trigger={<button className="p-2 rounded-md text-slate-600 hover:bg-slate-100"><HelpCircle className="w-4 h-4" /></button>}>
            <div className="text-sm text-slate-700 p-4">University Scheduling System (NexusTime)</div>
          </Popover>

          <div className="flex items-center gap-2 pl-2">
            <DropdownMenu trigger={<Avatar alt="Admin" />} items={menuItems} />
          </div>
        </div>
      </div>
    </header>
  );
};
