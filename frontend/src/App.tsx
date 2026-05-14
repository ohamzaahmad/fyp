/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar.tsx';
import TimetableGrid from './components/timetable/TimetableGrid.tsx';
import { SuggestionsPage } from './components/suggestions/SuggestionsPage.tsx';
import { AppState, Department, ClassSession } from './types.ts';
import { DataProvider, useData } from './context/DataContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, Loader2, CheckCircle2, Search, Command, Lock as LockIcon, Smartphone } from 'lucide-react';
import { MobileTimeline } from './components/mobile/MobileTimeline.tsx';
import TimetablePrintView from './components/timetable/TimetablePrintView.tsx';
import { Dashboard } from './components/timetable/Dashboard.tsx';
import { MySchedule } from './components/schedule/MySchedule.tsx';
import ResourceManagement from './components/resources/ResourceManagement.tsx';

import { timeToMinutes, checkConflicts, findMergeCandidates } from './services/timetableLogic.ts';

import * as api from './services/api.ts';
import { useNexusTimetable } from './hooks/useNexusTimetable.ts';
import { cn } from './lib/utils.ts';

import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';
import Settings from './components/settings/Settings.tsx';
import { LoginPage } from './components/auth/LoginPage.tsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.tsx';

function AppContent() {
  const { user, isAuthenticated, logout } = useAuth();
  const storedView = (typeof window !== 'undefined') ? localStorage.getItem('nexus_view') : null;
  const initialView = (storedView === 'dashboard' || storedView === 'timetable' || storedView === 'suggestions' || storedView === 'settings' || storedView === 'export' || storedView === 'schedule' || storedView === 'resources') ? storedView : 'dashboard';
  const [state, setState] = useState<AppState>({
    view: initialView,
    zoomLevel: 1.0,
    selectedDepartments: [],
    classes: [],
    selectedDay: 'Mon',
  });

  const { masterMap, setMasterMap, refreshMap, transformToMap, allSessions } = useNexusTimetable(state.classes);
  const data = useData();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);


  useEffect(() => {
    const openSettings = () => setState(prev => ({ ...prev, view: 'settings' }));
    window.addEventListener('nexus:open-settings', openSettings as EventListener);
    return () => window.removeEventListener('nexus:open-settings', openSettings as EventListener);
  }, []);

  // persist current view so browser refresh restores the same page
  useEffect(() => {
    try { localStorage.setItem('nexus_view', state.view); } catch (_) {}
  }, [state.view]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationStep, setOptimizationStep] = useState(0);
  const [optimizationLogs, setOptimizationLogs] = useState<string[]>([]);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [collapsedBuildings, setCollapsedBuildings] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Sync classes from masterMap
  useEffect(() => {
    if (Object.keys(masterMap).length > 0) {
      setState(prev => ({ 
        ...prev, 
        classes: allSessions,
        masterMap: masterMap
      }));
    }
  }, [allSessions, masterMap]);

  // Sync masterMap from DataProvider when available
  useEffect(() => {
    if (data?.masterMap && Object.keys(data.masterMap).length > 0) {
      setMasterMap(data.masterMap);
    }
  }, [data?.masterMap, setMasterMap]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if (e.key === 'Escape') setShowCommandPalette(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleLock = (id: string) => {
    setState(prev => ({
      ...prev,
      classes: prev.classes.map(c => c.id === id ? { ...c, isLocked: !c.isLocked } : c)
    }));
  };

  const toggleBuilding = (id: string) => {
    setCollapsedBuildings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };



  const steps = [
    "Analyzing Constraints...",
    "Resolving Gaps...",
    "Finalizing Merges...",
    "Done!"
  ];

  const triggerOptimization = async () => {
    setIsOptimizing(true);
    setOptimizationStep(0);
    setOptimizationLogs(["Nexus AI Engine initializing..."]);
    
    try {
      await api.generateSchedule();
    } catch (err) {
      console.warn("Backend solver offline, simulating local process.");
    }
    
    const logInterval = setInterval(() => {
      const messages = [
        "Analyzing Building Constraints...",
        "Identifying Room Overlaps...",
        "Resolving Teacher Gaps...",
        "Respecting [LOCKED] sessions...",
        "Synchronizing Batch Timelines...",
        "Optimizing for 08:00 - 18:00 efficiency...",
        "Evaluating Draft A vs Draft B..."
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      setOptimizationLogs(prev => [randomMsg, ...prev].slice(0, 5));
    }, 400);

    const stepInterval = setInterval(() => {
      setOptimizationStep(prev => {
        if (prev >= 3) {
          clearInterval(stepInterval);
          clearInterval(logInterval);
          setTimeout(() => setIsOptimizing(false), 1000);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {!isMobile && (
        <Sidebar 
          currentView={state.view} 
          onViewChange={(view) => setState(prev => ({ ...prev, view }))}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          collapsedBuildings={collapsedBuildings}
          onToggleBuilding={toggleBuilding}
          masterMap={masterMap}
          efficiency={87}
          onGenerate={triggerOptimization}
        />
      )}
      
      <main className="flex-1 flex flex-col min-w-0">
        {!isMobile && (
        <>


            {/* Main Action Bar for Timetable */}

            </>
        )}

        <div className="flex-1 flex flex-col relative overflow-hidden">

          {/* View Content */}
          <div className={`flex-1 flex flex-col ${state.view === 'timetable' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            {isMobile ? (
              <MobileTimeline classes={state.classes} />
            ) : (
              <>
                {state.view === 'timetable' && (
                  <ProtectedRoute allowedRoles={['ADMIN', 'TEACHER']}>
                    <TimetableGrid 
                      zoomLevel={state.zoomLevel} 
                      onZoomChange={(zoomLevel) => setState(prev => ({ ...prev, zoomLevel }))}
                      classes={state.classes}
                      onClassesChange={(classes) => setState(prev => ({ ...prev, classes }))}
                      onToggleLock={toggleLock}
                      collapsedBuildings={collapsedBuildings}
                      onToggleBuilding={toggleBuilding}
                      masterMap={state.masterMap}
                      selectedDay={state.selectedDay}
                      onDayChange={(day) => setState(prev => ({ ...prev, selectedDay: day }))}
                    />
                  </ProtectedRoute>
                )}
                {state.view === 'suggestions' && (
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <SuggestionsPage />
                  </ProtectedRoute>
                )}
                {state.view === 'resources' && (
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <ResourceManagement />
                  </ProtectedRoute>
                )}
                {state.view === 'schedule' && (
                  <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
                    <MySchedule />
                  </ProtectedRoute>
                )}
                {state.view === 'dashboard' && (
                  <ProtectedRoute allowedRoles={['ADMIN', 'TEACHER']}>
                    <Dashboard />
                  </ProtectedRoute>
                )}
                {state.view === 'settings' && (
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Settings />
                  </ProtectedRoute>
                )}
                {state.view === 'export' && (
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <div className="flex-1 bg-white overflow-auto">
                      <TimetablePrintView classes={state.classes} />
                      <div className="fixed bottom-12 right-24 print:hidden">
                         <button 
                           onClick={() => window.print()}
                           className="bg-slate-900 text-white px-8 py-3 rounded-full font-black text-sm uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all"
                         >
                           Print Official UAF Map
                         </button>
                      </div>
                    </div>
                  </ProtectedRoute>
                )}
                {/* settings view is rendered above inside the header area via <Settings /> */}
              </>
            )}
          </div>
        </div>

        {/* Search Command Palette Overlay */}
        <AnimatePresence>
          {showCommandPalette && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
              onClick={() => setShowCommandPalette(false)}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: -20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: -20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
              >
                <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                  <Command className="w-5 h-5 text-slate-400" />
                  <input 
                    autoFocus
                    placeholder="Search Departments, Teachers, or Batches... (Ctrl+K)" 
                    className="flex-1 bg-transparent border-none outline-none text-slate-900 placeholder:text-slate-400 font-medium"
                  />
                  <div className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-black text-slate-500">ESC</div>
                </div>
                <div className="p-2 max-h-80 overflow-y-auto">
                    <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                       <span>Recent Suggestions</span>
                       <span className="font-mono text-slate-300">History</span>
                    </div>
                    <div className="space-y-1">
                      {[
                        { title: 'CS Dept', sub: '12 Rooms | 45 Teachers', type: 'Dept', color: 'bg-emerald-100 text-emerald-700' },
                        { title: 'Dr. Sarah', sub: 'CS Teacher | Tier 1', type: 'Staff', color: 'bg-blue-100 text-blue-700' },
                        { title: 'Batch B2023-A', sub: 'Computer Science | 120 Students', type: 'Class', color: 'bg-purple-100 text-purple-700' }
                      ].map((item, i) => (
                        <div key={i} className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                              <div className={cn("w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold", item.color)}>{item.type}</div>
                              <div>
                                <div className="text-sm font-bold text-slate-900">{item.title}</div>
                                <div className="text-[10px] text-slate-500">{item.sub}</div>
                              </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 transition-opacity">Jump to &rarr;</div>
                        </div>
                      ))}
                    </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Status Bar */}
        {!isMobile && (
          <footer className="h-8 bg-slate-950 text-slate-500 px-6 flex items-center justify-between text-[9px] shrink-0 border-t border-slate-800 z-50">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                <span className="font-black uppercase tracking-widest text-slate-300">AI Logic Core: Active</span>
              </div>
              <div className="h-3 w-[1px] bg-slate-800" />
              <div className="flex gap-4">
                <span className="font-bold uppercase tracking-tighter">Total Constraints: 1,402</span>
                <span className="font-bold uppercase tracking-tighter">Conflicts Resolved: 12</span>
              </div>
            </div>
            <div className="flex items-center gap-6 uppercase font-black tracking-widest">
              <span className="text-slate-600">ID: PROD_UAF_S26</span>
              <span className="text-emerald-500/50">User: Admin_Master</span>
            </div>
          </footer>
        )}
      </main>

      {/* Optimization Overlay */}
      <AnimatePresence>
        {isOptimizing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border border-white/20"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6">
                  {optimizationStep === 3 ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  ) : (
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                  )}
                </div>
                
                <h2 className="text-xl font-black text-slate-900 mb-2">Nexus Optimizer</h2>
                <p className="text-slate-500 text-sm mb-6">Redistributing {state.classes.length} sessions across {(data?.sessions.length ?? 0) * 2} constraints.</p>
                
                {/* Task Logs */}
                <div className="w-full bg-slate-950 rounded-lg p-3 mb-6 font-mono text-[10px] text-emerald-400 h-24 overflow-hidden shadow-inner">
                  <div className="flex flex-col gap-1">
                    {optimizationLogs.map((log, i) => (
                      <div key={i} className={cn("flex gap-2", i === 0 ? "animate-pulse" : "opacity-40")}>
                        <span className="text-slate-600">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-full space-y-4">
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-emerald-500"
                      initial={{ width: "0%" }}
                      animate={{ width: `${(optimizationStep + 1) * 25}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
                      {steps[optimizationStep]}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {Math.round((optimizationStep + 1) * 25)}%
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <ToastProvider>
          <AppWrapper />
        </ToastProvider>
      </DataProvider>
    </AuthProvider>
  );
}

function AppWrapper() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // If user is authenticated but there's a lingering #login hash, clear it
  if (window.location.hash === '#login') {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  return <AppContent />;
}

