import React from 'react';
import { Search, Filter, Bell, HelpCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { DEPARTMENTS } from '../../constants.ts';
import { Department } from '../../types.ts';
import { cn } from '../../lib/utils.ts';

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

  const handleDeptToggle = (dept: Department) => {
    if (selectedDepts.includes(dept)) {
      setSelectedDepts(selectedDepts.filter(d => d !== dept));
    } else {
      setSelectedDepts([...selectedDepts, dept]);
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-6 flex-1 max-w-3xl">
        <div className="relative group flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
          <input 
            type="text" 
            placeholder="Search Faculty or Room..." 
            className="w-full bg-slate-100 border border-transparent rounded px-3 py-1.5 pl-9 text-xs focus:outline-none focus:bg-white focus:border-slate-300 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {DEPARTMENTS.map((dept) => (
            <button
              key={dept}
              onClick={() => handleDeptToggle(dept)}
              className={cn(
                "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-tight transition-all border",
                selectedDepts.includes(dept)
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/10"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-8 divide-x divide-slate-100">
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Optimization Score</p>
            <p className="text-sm font-black text-emerald-600 leading-none">{efficiency}% Efficiency</p>
          </div>
          <div className="w-10 h-10 relative group">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={14}
                  outerRadius={18}
                  startAngle={90}
                  endAngle={450}
                  dataKey="value"
                  stroke="none"
                  paddingAngle={0}
                >
                  <Cell fill="#059669" />
                  <Cell fill="#f1f5f9" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[10px] font-black text-slate-700">
              {efficiency}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pl-8">
          <button className="bg-slate-950 text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10">
            Generate Optimized
          </button>
        </div>
      </div>
    </header>
  );
};
