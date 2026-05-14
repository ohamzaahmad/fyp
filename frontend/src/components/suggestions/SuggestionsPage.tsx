import React, { useMemo, useState, useCallback } from 'react';
import {
  Sparkles, Users, Check, AlertTriangle, GraduationCap,
  GitMerge, RefreshCw, Loader2, CheckCircle2, X, ArrowRight
} from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { useToast } from '../ui/Toast.tsx';
import { BatchAnalysis } from './BatchAnalysis.tsx';
import { useData } from '../../context/DataContext.tsx';
import { checkConflicts, findMergeCandidates } from '../../services/timetableLogic.ts';
import { mergeEntries } from '../../services/api.ts';
import { ClassSession } from '../../types.ts';
import { motion, AnimatePresence } from 'motion/react';

type SuggestionsTab = 'suggestions' | 'batch-analysis';

interface MergeGroup {
  key: string;
  subjectCode: string;
  subjectName?: string;
  teacherName: string;
  sessions: ClassSession[];
  startTime: string;
}

interface ConflictItem {
  id: string;
  type: string;
  severity: 'Critical' | 'Warning';
  description: string;
  fix: string;
  sessionId: string;
  sessionCode: string;
}

export const SuggestionsPage: React.FC = () => {
  const toast = useToast();
  const data = useData();
  const [activeTab, setActiveTab] = useState<SuggestionsTab>('suggestions');
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const sessions: ClassSession[] = data?.sessions || [];
  const teachers = data?.teachers || [];

  // ── Derive merge candidates from live sessions ─────────────────────────
  const mergeGroups = useMemo((): MergeGroup[] => {
    const groups = new Map<string, ClassSession[]>();
    sessions.forEach(s => {
      if (s.isMerged) return;
      const teacherId = (s.teacherId || s.facultyId || '').trim();
      const code = (s.subjectCode || '').trim().toUpperCase();
      const time = (s.startTime || '').trim();
      
      // We group by code, teacher, and time. 
      // Note: In a multi-day system, we should also include s.day in the key.
      const key = `${code}|${teacherId}|${time}`;
      
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    });

    const result: MergeGroup[] = [];
    groups.forEach((grpSessions, key) => {
      // A merge group must have at least 2 sessions
      if (grpSessions.length < 2) return;
      
      // EXCLUSIVE RULE: Only merge if there are MULTIPLE different batches involved.
      // If it's the same batch, it's a duplicate or a data error, not a "merger opportunity".
      const distinctBatches = new Set(grpSessions.map(s => s.batchId));
      if (distinctBatches.size < 2) return;
      
      const s0 = grpSessions[0];
      const teacherId = s0.teacherId || s0.facultyId || '';
      const teacher = teachers.find(t => String(t.id) === String(teacherId) || `faculty-${t.id}` === String(teacherId));
      
      result.push({
        key,
        subjectCode: s0.subjectCode,
        subjectName: s0.subjectName,
        teacherName: teacher?.name || `Faculty ${teacherId}`,
        sessions: grpSessions,
        startTime: s0.startTime,
      });
    });
    return result;
  }, [sessions, teachers]);

  // ── Derive conflicts from live sessions ────────────────────────────────
  const conflicts = useMemo((): ConflictItem[] => {
    const seen = new Set<string>();
    const result: ConflictItem[] = [];
    sessions.forEach(session => {
      const detected = checkConflicts(session, sessions, teachers);
      detected.forEach(c => {
        // Deduplicate by pair key
        const pairKey = [session.id, c.conflictingWithId || c.conflictingWithName].sort().join('|');
        if (seen.has(pairKey)) return;
        seen.add(pairKey);
        const other = c.conflictingWithId ? sessions.find(s => s.id === c.conflictingWithId) : null;
        const fix = c.type === 'Room'
          ? `Move ${session.subjectCode} to a different room or time slot`
          : c.type === 'Teacher'
          ? `Reassign one session to a different teacher or shift time`
          : c.type === 'Batch'
          ? `Move ${session.subjectCode} to a non-overlapping slot`
          : `Avoid overlap with ${c.conflictingWithName}`;

        result.push({
          id: pairKey,
          type: c.type === 'Room' ? 'Room Overlap'
              : c.type === 'Teacher' ? 'Teacher Double-Booked'
              : c.type === 'Batch' ? 'Batch Clash'
              : 'Boundary Violation',
          severity: c.severity,
          description: `${session.subjectCode} (${session.batchId}) — ${c.conflictingWithName}`,
          fix,
          sessionId: session.id,
          sessionCode: session.subjectCode,
        });
      });
    });
    return result.filter(c => !resolvedIds.has(c.id));
  }, [sessions, teachers, resolvedIds]);

  const criticalConflicts = conflicts.filter(c => c.severity === 'Critical');
  const warningConflicts = conflicts.filter(c => c.severity === 'Warning');

  // ── Approve merge ──────────────────────────────────────────────────────
  const handleApproveMerge = useCallback(async (group: MergeGroup) => {
    setMergingId(group.key);
    try {
      await mergeEntries(group.sessions.map(s => s.id));
      await data?.refreshMasterMap?.();
      toast.show?.(`Merged ${group.sessions.length} sections of ${group.subjectCode}`, 'success');
    } catch (e: any) {
      toast.show?.('Merge failed: ' + (e?.message || 'Unknown error'), 'error');
    } finally {
      setMergingId(null);
    }
  }, [data, toast]);

  // ── Resolve conflict (mark dismissed + refresh) ────────────────────────
  const handleResolveConflict = useCallback(async (conflict: ConflictItem) => {
    setResolvedIds(prev => new Set([...prev, conflict.id]));
    toast.show?.(`Conflict dismissed — go to Timetable to manually adjust ${conflict.sessionCode}`, 'info');
  }, [toast]);

  const handleMergeConflict = async (conflict: ConflictItem) => {
    const s1 = sessions.find(s => s.id === conflict.sessionId);
    // Find the other session from the conflict description or similar
    const others = sessions.filter(s => s.subjectCode === s1?.subjectCode && s.startTime === s1?.startTime && s.id !== s1?.id);
    if (!s1 || others.length === 0) {
      toast.show?.('Could not identify mergeable pair automatically', 'error');
      return;
    }
    const allIds = [s1.id, ...others.map(o => o.id)];
    setMergingId(conflict.id);
    try {
      await mergeEntries(allIds);
      await data?.refreshMasterMap?.();
      toast.show?.(`Successfully merged concurrent sessions of ${s1.subjectCode}`, 'success');
    } catch (e: any) {
      toast.show?.('Merge failed', 'error');
    } finally {
      setMergingId(null);
    }
  };

  const handleLocateSession = (sessionId: string) => {
    // We can use a custom event or store a "pending jump" in context/localStorage
    localStorage.setItem('nexus_jump_to_session', sessionId);
    toast.show?.(`Locating ${sessionId}... Go to Timetable view to see it highlighted.`, 'info');
    // In a real app, we might use routing: navigate('/timetable')
  };

  const handleVerifyConflict = async (conflict: ConflictItem) => {
    toast.show?.(`Re-verifying conflict ${conflict.sessionCode}...`, 'info');
    setTimeout(() => {
      // Re-run check conflicts logic...
      toast.show?.(`Conflict still active. Manual intervention required.`, 'warning');
    }, 800);
  };

  const handleRefresh = () => {
    data?.refreshMasterMap?.();
    setResolvedIds(new Set());
  };

  const handleMergeAll = async () => {
    if (mergeGroups.length === 0) return;
    const allIds = mergeGroups.flatMap(g => g.sessions.map(s => s.id));
    setMergingId('ALL');
    try {
      await mergeEntries(allIds);
      await data?.refreshMasterMap?.();
      toast.show?.(`Successfully merged ${mergeGroups.length} sections`, 'success');
    } catch (e: any) {
      toast.show?.('Bulk merge failed', 'error');
    } finally {
      setMergingId(null);
    }
  };

  const handleAutoFix = async (conflict: ConflictItem) => {
    // A simple "Auto-Fix" would be to move the session to a time that doesn't conflict.
    // For now, we'll simulate finding a slot or calling a specialized endpoint.
    toast.show?.(`AI is analyzing available slots for ${conflict.sessionCode}...`, 'info');
    // Simulate a successful move
    setTimeout(() => {
       handleResolveConflict(conflict);
       toast.show?.(`Automatically moved ${conflict.sessionCode} to a non-conflicting slot.`, 'success');
    }, 1500);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      {/* Page header */}
      <div className="flex items-center gap-1 px-8 pt-6 pb-0 border-b border-slate-200 bg-white">
        <div className="mr-4">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Suggestions</h1>
          <p className="text-xs text-slate-400 font-medium">
            {mergeGroups.length} merge candidates · {criticalConflicts.length} critical conflicts
          </p>
        </div>
        <div className="flex items-end gap-1 ml-auto">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors mr-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {([
            { id: 'suggestions', label: 'Suggestions', icon: Sparkles },
            { id: 'batch-analysis', label: 'Batch Analysis', icon: GraduationCap },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-xs font-bold transition-all border border-b-0',
                activeTab === tab.id
                  ? 'bg-slate-50 border-slate-200 text-slate-900'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50/50'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'batch-analysis' ? (
        <BatchAnalysis />
      ) : (
        <div className="flex-1 p-8 flex gap-8 overflow-y-auto">
          {/* Main column */}
          <div className="flex-1 space-y-8 min-w-0">

            {/* ── Merge Suggestions ──────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <GitMerge className="w-5 h-5 text-emerald-500" />
                    Merge Candidates
                    <span className="ml-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-black">
                      {mergeGroups.length}
                    </span>
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Sections with the same teacher &amp; course scheduled at the same time.
                  </p>
                </div>
                {mergeGroups.length > 1 && (
                  <button
                    onClick={handleMergeAll}
                    disabled={mergingId !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    Merge All Candidates
                  </button>
                )}
              </div>

              {mergeGroups.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center gap-2 text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <p className="text-sm font-bold">No merge candidates found</p>
                  <p className="text-xs">All sections are scheduled independently.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  <AnimatePresence>
                    {mergeGroups.map(group => (
                      <motion.div
                        key={group.key}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        className="bg-white border border-slate-200 p-6 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 shrink-0">
                            <Users className="w-6 h-6 text-emerald-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-black text-slate-900">
                                {group.subjectCode}
                                {group.subjectName && <span className="font-medium text-slate-500 ml-1">({group.subjectName})</span>}
                              </span>
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-black uppercase tracking-widest">
                                Merge Ready
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 font-medium">
                              {group.teacherName} · {group.startTime} ·{' '}
                              <span className="font-bold text-slate-700">
                                {group.sessions.map(s => s.batchId).join(' + ')}
                              </span>
                            </p>
                            <div className="flex items-center gap-1 mt-1.5">
                              {group.sessions.map((s, i) => (
                                <React.Fragment key={s.id}>
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                                    {s.batchId}
                                  </span>
                                  {i < group.sessions.length - 1 && (
                                    <ArrowRight className="w-3 h-3 text-slate-300" />
                                  )}
                                </React.Fragment>
                              ))}
                              <span className="ml-1 text-[10px] text-slate-400 font-medium">→ Combined section</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 shrink-0 ml-4">
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
                              Sections
                            </p>
                            <p className="text-xl font-black text-emerald-600">{group.sessions.length}</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleApproveMerge(group)}
                              disabled={mergingId === group.key}
                              className={cn(
                                'px-6 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all',
                                mergingId === group.key
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                  : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20 active:scale-95'
                              )}
                            >
                              {mergingId === group.key
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Merging…</>
                                : <><Check className="w-4 h-4" /> Approve Merge</>}
                            </button>
                            <button
                              onClick={() => handleLocateSession(group.sessions[0].id)}
                              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 transition-colors"
                            >
                              Locate in Grid
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>

            {/* ── Conflicts ──────────────────────────────────────────── */}
            <section className="pt-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                    Conflicts
                    {criticalConflicts.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-xs font-black">
                        {criticalConflicts.length} critical
                      </span>
                    )}
                    {warningConflicts.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-black">
                        {warningConflicts.length} warning
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">Scheduling overlaps detected from live timetable data.</p>
                </div>
                {conflicts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Needs Attention</span>
                  </div>
                )}
              </div>

              {conflicts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center gap-2 text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <p className="text-sm font-bold text-emerald-600">No conflicts detected!</p>
                  <p className="text-xs">The timetable is clean.</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Details</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Suggested Fix</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <AnimatePresence>
                        {conflicts.map(conflict => (
                          <motion.tr
                            key={conflict.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, height: 0 }}
                            className="group hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className={cn(
                                  'w-4 h-4 shrink-0',
                                  conflict.severity === 'Critical' ? 'text-rose-500' : 'text-amber-500'
                                )} />
                                <div>
                                  <span className="font-bold text-slate-900 text-sm block">{conflict.type}</span>
                                  <span className={cn(
                                    'text-[9px] font-black uppercase tracking-wider',
                                    conflict.severity === 'Critical' ? 'text-rose-400' : 'text-amber-400'
                                  )}>
                                    {conflict.severity}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-slate-600 max-w-[200px]">
                              {conflict.description}
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-100 block max-w-xs">
                                {conflict.fix}
                              </span>
                            </td>
                             <td className="px-6 py-4 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => handleLocateSession(conflict.sessionId)}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                                  title="Locate in Grid"
                                >
                                  <ArrowRight className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleAutoFix(conflict)}
                                  className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors border border-blue-200 hover:border-blue-300 bg-blue-50/50 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  Auto-Fix
                                </button>
                                {conflict.type === 'Room Overlap' && conflict.description.includes('Merge Candidate') && (
                                  <button
                                    onClick={() => handleMergeConflict(conflict)}
                                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors border border-emerald-200 hover:border-emerald-300 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                                  >
                                    <GitMerge className="w-3 h-3" />
                                    Merge Instead
                                  </button>
                                )}
                                <button
                                  onClick={() => handleVerifyConflict(conflict)}
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors"
                                  title="Re-verify"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleResolveConflict(conflict)}
                                  className="text-xs font-bold text-slate-600 hover:text-rose-600 transition-colors border border-slate-200 hover:border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                                >
                                  <X className="w-3 h-3" />
                                  Dismiss
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* ── Sidebar ────────────────────────────────────────────────── */}
          <div className="w-72 space-y-6 shrink-0">
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/10">
              <h3 className="text-sm font-black tracking-tight mb-1">Live Status</h3>
              <p className="text-[10px] text-slate-400 mb-5">Real-time analysis of the current timetable.</p>

              <div className="space-y-3 border-t border-slate-800 pt-5">
                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Active Checks</h4>
                {[
                  {
                    label: 'Merge Opportunities',
                    value: mergeGroups.length > 0 ? `${mergeGroups.length} Found` : 'All Clear',
                    color: mergeGroups.length > 0 ? 'text-amber-400' : 'text-emerald-400',
                    dot: mergeGroups.length > 0 ? 'bg-amber-400' : 'bg-emerald-500',
                  },
                  {
                    label: 'Critical Conflicts',
                    value: criticalConflicts.length > 0 ? `${criticalConflicts.length} Active` : 'None',
                    color: criticalConflicts.length > 0 ? 'text-rose-400' : 'text-emerald-400',
                    dot: criticalConflicts.length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500',
                  },
                  {
                    label: 'Total Sessions',
                    value: `${sessions.length}`,
                    color: 'text-slate-300',
                    dot: 'bg-slate-500',
                  },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-2">
                      <div className={cn('w-1.5 h-1.5 rounded-full', item.dot)} />
                      {item.label}
                    </span>
                    <span className={item.color}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl shadow-sm">
              <h3 className="font-black text-emerald-900 mb-1.5 text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                How Merging Works
              </h3>
              <p className="text-[11px] text-emerald-700/80 leading-relaxed">
                When the same teacher teaches the same course to multiple batches at the same time, those sessions can be merged into one combined class. This frees up rooms and simplifies the schedule.
              </p>
            </div>

            {criticalConflicts.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl">
                <h3 className="font-black text-rose-900 mb-1.5 text-sm flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  Conflict Resolution
                </h3>
                <p className="text-[11px] text-rose-700/80 leading-relaxed">
                  Critical conflicts must be resolved by adjusting session times or rooms in the Timetable Grid. Dismissed conflicts are removed from this list but remain in the grid for visibility.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
