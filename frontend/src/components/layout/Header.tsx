import React, { useEffect, useState } from 'react';
import { Search, Filter, Bell, HelpCircle, User } from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { Department } from '../../types.ts';
import { cn } from '../../lib/utils.ts';
import { Button } from '../ui/Button.tsx';
import Avatar from '../ui/Avatar.tsx';
import DropdownMenu from '../ui/DropdownMenu.tsx';
import Popover from '../ui/Popover.tsx';
import ConfirmDialog from '../ui/ConfirmDialog.tsx';
import { useToast } from '../ui/Toast.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { generateSchedule, getAnalyticsLogs } from '../../services/api.ts';
import { markNotificationRead } from '../../services/notifications.ts';

interface HeaderProps {
  selectedDepts: Department[];
  setSelectedDepts: (depts: Department[]) => void;
  efficiency: number;
}

export const Header: React.FC<HeaderProps> = ({ 
  selectedDepts, 
  setSelectedDepts, 
  efficiency 
}) => {
  const chartData = [
    { value: efficiency },
    { value: 100 - efficiency }
  ];

  const data = useData();
  const [query, setQuery] = useState('');
  const departments = data?.departments || [];

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const matches = (data?.departments || []).filter(d => d.toLowerCase().includes(query.toLowerCase()));
      if (matches.length > 0) {
        setSelectedDepts(matches as Department[]);
      }
      setQuery('');
    }
  };

  const handleDeptToggle = (dept: Department) => {
    if (selectedDepts.includes(dept)) {
      setSelectedDepts(selectedDepts.filter(d => d !== dept));
    } else {
      setSelectedDepts([...selectedDepts, dept]);
    }
  };

  const toast = useToast();
  const { logout } = useAuth();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const loadNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const logs = await getAnalyticsLogs();
      const items = Array.isArray((logs as any)?.logs) ? (logs as any).logs : (Array.isArray(logs) ? logs : (logs?.logs || []));
      setNotifications(items.map((it: any, i: number) => ({ id: it.id ?? i, message: it.message ?? it.title ?? it.summary ?? JSON.stringify(it), created_at: it.created_at ?? it.timestamp ?? new Date().toISOString(), unread: it.unread ?? true })));
    } catch (e) {
      console.warn('Failed to load analytics logs for notifications', e);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => { if (mounted) await loadNotifications(); })();
    const iv = setInterval(() => { if (mounted) loadNotifications(); }, 30000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  const menuItems = [
    { label: 'Profile', onSelect: () => { try { toast.show('Profile clicked', 'info'); } catch(_){} } },
    { label: 'Settings', onSelect: () => window.dispatchEvent(new CustomEvent('nexus:open-settings')) },
    { label: 'Logout', onSelect: () => { logout(); try { toast.show('Logged out', 'info'); } catch(_){} } },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;
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
            placeholder="Search Departments, Teachers, Batches..." 
            className="w-full bg-slate-100 border border-transparent rounded-xl px-4 py-2 pl-10 text-sm focus:outline-none focus:bg-white focus:border-slate-300 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {visibleDepts.map((dept) => (
            <button
              key={dept}
              onClick={() => handleDeptToggle(dept)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all border",
                selectedDepts.includes(dept)
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-md"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              {dept}
            </button>
          ))}
          {extraDepts.length > 0 && (
            <div className="flex items-center">
              <DropdownMenu trigger={<button className="px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200">+{extraDepts.length}</button>} items={extraDepts.map(d => ({ label: d, onSelect: () => handleDeptToggle(d) }))} />
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
                try { toast.show('Optimization started', 'success'); } catch(_){}
              } catch (err) {
                try { toast.show('Failed to start optimization', 'error'); } catch(_){}
              }
            }}
          />

          <Popover trigger={<button className="relative p-2 rounded-md text-slate-600 hover:bg-slate-100"><Bell className="w-4 h-4" />{unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>}</button>}>
            <div className="min-w-[320px]">
              <div className="text-sm font-bold mb-2">Live Constraint Feed</div>
              {loadingNotifications && <div className="text-xs text-slate-400">Loading...</div>}
              {!loadingNotifications && notifications.length === 0 && <div className="text-sm text-slate-500">No live events</div>}
              <div className="space-y-2 max-h-64 overflow-auto">
                {notifications.map((n: any) => (
                  <div key={n.id} className="p-2 rounded hover:bg-slate-50 flex items-start justify-between">
                    <div className="text-sm text-slate-700">{n.message}</div>
                    <div className="flex flex-col items-end">
                      <div className="text-[10px] text-slate-400">{n.created_at ? new Date(n.created_at).toLocaleTimeString() : ''}</div>
                      <div className="mt-1">
                        <button onClick={async () => { await markNotificationRead(n.id); setNotifications(prev => prev.map(p => p.id === n.id ? { ...p, unread: false } : p)); try { toast.show('Marked read', 'info'); } catch(_){} }} className="text-[10px] px-2 py-1 bg-slate-100 rounded">Mark</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-right">
                <button onClick={() => setNotifications([])} className="text-xs px-3 py-2 bg-slate-100 rounded">Clear All</button>
              </div>
            </div>
          </Popover>

          <Popover trigger={<button className="p-2 rounded-md text-slate-600 hover:bg-slate-100"><HelpCircle className="w-4 h-4" /></button>}>
            <div className="text-sm text-slate-700">Help &amp; docs are available in the docs portal.</div>
          </Popover>

          <div className="flex items-center gap-2 pl-2">
            <DropdownMenu trigger={<Avatar alt="Admin" />} items={menuItems} />
          </div>
        </div>
      </div>
    </header>
  );
};
