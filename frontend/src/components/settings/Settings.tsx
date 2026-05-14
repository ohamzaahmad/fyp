import React, { useEffect, useState } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { updateSystemSettings } from '../../services/api.ts';
import { Building2, Save, GraduationCap, Clock, Type, Image as ImageIcon } from 'lucide-react';

export const Settings: React.FC = () => {
  const data = useData();
  const { logout } = useAuth();

  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [formData, setFormData] = useState({
    app_name: '',
    org_name: '',
    academic_term: '',
    logo_url: '',
    break_start: '',
    break_end: '',
    max_daily_classes: 6,
    gap_penalty: 1.0,
    working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as string[],
  });

  useEffect(() => {
    // Load local theme
    const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('nexus_theme') : null;
    if (storedTheme === 'dark' || (!storedTheme && document.documentElement.classList.contains('dark'))) {
      setTheme('dark');
    } else {
      setTheme('light');
    }

    // Load system settings from context
    if (data.systemSettings) {
      setFormData({
        app_name: data.systemSettings.app_name || '',
        org_name: data.systemSettings.org_name || '',
        academic_term: data.systemSettings.academic_term || '',
        logo_url: data.systemSettings.logo_url || '',
        break_start: data.systemSettings.break_start?.substring(0, 5) || '',
        break_end: data.systemSettings.break_end?.substring(0, 5) || '',
        max_daily_classes: data.systemSettings.max_daily_classes || 6,
        gap_penalty: data.systemSettings.gap_penalty || 1.0,
        working_days: data.systemSettings.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      });
    }
  }, [data.systemSettings]);

  const applyTheme = (t: 'light' | 'dark') => {
    if (t === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('nexus_theme', t);
    setTheme(t);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      applyTheme(theme);
      
      const payload = {
        ...formData,
        break_start: formData.break_start || null,
        break_end: formData.break_end || null,
      };

      await updateSystemSettings(payload);
      await data.refreshAll(); // Refresh to update the global context strings
    } catch (err) {
      console.error("Failed to save settings", err);
      alert("Failed to save settings. Check console for details.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutClear = () => {
    logout();
    localStorage.clear();
  };

  return (
    <div className="flex-1 p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Manage global configurations and preferences</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSave} 
              disabled={saving} 
              className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* General Settings */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800">General Identity</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Application Name</label>
                <div className="relative">
                  <Type className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    name="app_name"
                    value={formData.app_name} 
                    onChange={handleChange} 
                    placeholder="NexusTime AI"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">Displayed in the main navigation sidebar.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Organization Name</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    name="org_name"
                    value={formData.org_name} 
                    onChange={handleChange} 
                    placeholder="University Name"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">Used for official timetable printouts.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Academic Term</label>
                <div className="relative">
                  <GraduationCap className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    name="academic_term"
                    value={formData.academic_term} 
                    onChange={handleChange} 
                    placeholder="e.g. Fall 2026 Semester"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Logo URL</label>
                <div className="relative">
                  <ImageIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    name="logo_url"
                    value={formData.logo_url} 
                    onChange={handleChange} 
                    placeholder="https://example.com/logo.png"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">Public URL for the organization logo (Header/Login/Sidebar).</p>
              </div>
            </div>
          </div>

          {/* Scheduling Rules */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800">Global Scheduling Rules</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Break Start Time</label>
                <input 
                  type="time" 
                  name="break_start"
                  value={formData.break_start} 
                  onChange={handleChange} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Break End Time</label>
                <input 
                  type="time" 
                  name="break_end"
                  value={formData.break_end} 
                  onChange={handleChange} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Max Daily Classes (Per Batch)</label>
                <input 
                  type="number" 
                  min={1} 
                  max={12} 
                  name="max_daily_classes"
                  value={formData.max_daily_classes} 
                  onChange={handleChange} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Gap Penalty Weight</label>
                <input 
                  type="number" 
                  min={0} 
                  step={0.1} 
                  name="gap_penalty"
                  value={formData.gap_penalty} 
                  onChange={handleChange} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                />
                <p className="text-xs text-slate-400 mt-2">Higher values strictly enforce contiguous classes.</p>
              </div>

              <div className="md:col-span-2 mt-4 pt-6 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">University Working Days</label>
                <div className="flex flex-wrap gap-3">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                    const isActive = formData.working_days.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            working_days: isActive 
                              ? prev.working_days.filter(d => d !== day)
                              : [...prev.working_days, day]
                          }));
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                          isActive 
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                            : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400 mt-3">Select the days the university is open for scheduling classes.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
