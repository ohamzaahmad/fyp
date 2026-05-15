import React from 'react';
import { useData } from '../../context/DataContext.tsx';
import { cn } from '../../lib/utils.ts';
import { Clock, Scissors, Zap, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { calculateGaps, timeToMinutes } from '../../services/timetableLogic.ts';
import { getBatchDiagnostic, compactSchedule, downloadBatchTimetable } from '../../services/api.ts';
import { useToast } from '../ui/Toast.tsx';
import DropdownMenu from '../ui/DropdownMenu.tsx';
import ConfirmDialog from '../ui/ConfirmDialog.tsx';
import { Button } from '../ui/Button.tsx';

export const BatchAnalysis: React.FC = () => {
  const data = useData();
  const toast = useToast();
  const availableBatches = Array.from(new Set((data?.sessions || []).map(c => c.batchId))).sort();
  const [batchId, setBatchId] = React.useState<string | null>(availableBatches.length > 0 ? availableBatches[0] : null);
  const [diagnostic, setDiagnostic] = React.useState<any | null>(null);
  const [diagLoading, setDiagLoading] = React.useState(false);
  const [compactPreview, setCompactPreview] = React.useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  React.useEffect(() => {
    if (!batchId && availableBatches.length > 0) setBatchId(availableBatches[0]);
  }, [availableBatches, batchId]);

  const batchClasses = (data?.sessions || []).filter(c => c.batchId === batchId);

  // Days available for the selected batch (normalized strings)
  const availableDays = Array.from(new Set(batchClasses.map(s => String(s.day_of_week || '').trim()).filter(Boolean))).sort();
  const [selectedDay, setSelectedDay] = React.useState<string | null>(availableDays.length > 0 ? availableDays[0] : null);

  React.useEffect(() => {
    if (availableDays.length > 0) {
      if (!selectedDay || !availableDays.includes(selectedDay)) setSelectedDay(availableDays[0]);
    } else {
      setSelectedDay(null);
    }
  }, [availableDays]);

  React.useEffect(() => {
    setCompactPreview(null);
  }, [batchId, selectedDay]);

  const runDiag = async (b?: string | null) => {
    const bid = b ?? batchId;
    if (!bid) return;
    setDiagLoading(true);
    try {
      const res = await getBatchDiagnostic(bid);
      setDiagnostic(res);
      try { toast.show(`Diagnostic complete: ${res.continuity}% continuity`, 'success'); } catch (_) {}
    } catch (e: any) {
      const msg = e?.message || String(e);
      toast.show(`Diagnostic failed: ${msg}`, 'error');
    } finally {
      setDiagLoading(false);
    }
  };

  const runPreview = async () => {
    if (!batchId) return;
    setPreviewLoading(true);
    try {
      const res = await compactSchedule(batchId, selectedDay, { mode: 'preview' });
      setCompactPreview(res);
      const count = Array.isArray(res?.proposals) ? res.proposals.length : 0;
      try { toast.show(`Preview ready: ${count} proposed move${count === 1 ? '' : 's'}`, 'success'); } catch (_) {}
    } catch (e: any) {
      toast.show(`Preview failed: ${e?.message || String(e)}`, 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Filter diagnostic gaps by selected day when diagnostic exists
  const diagnosticGaps = React.useMemo(() => {
    if (!diagnostic || !diagnostic.gaps) return [];
    if (!selectedDay) return diagnostic.gaps;
    return diagnostic.gaps.filter((g: any) => String(g.day).trim() === selectedDay);
  }, [diagnostic, selectedDay]);
  const START_HOUR = 8;
  const END_HOUR = 18;
  const totalHours = END_HOUR - START_HOUR;

  // Use sessions for the selected day when computing gaps/metrics. If no day
  // is selected, fall back to analyzing all sessions for the batch.
  const batchDayClasses = selectedDay ? batchClasses.filter(s => String(s.day_of_week || '').trim() === selectedDay) : batchClasses;
  const gaps = calculateGaps(batchDayClasses);
  const totalWasted = gaps.reduce((acc, g) => acc + g.duration, 0);

  const formatTime = (mins?: number) => {
    if (mins == null) return '';
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    return `${h}:${m}`;
  };

  return (
    <div className="flex-1 p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">Schedule Analysis <span className="text-slate-400 font-medium">/ {batchId}</span></h1>
            {diagnostic && (
              <div className="mt-2 text-sm text-slate-600">
                Continuity: <strong className="text-emerald-700">{diagnostic.continuity}%</strong> • Sessions: <strong>{diagnostic.sessions}</strong> • Total Minutes: <strong>{diagnostic.total_minutes}</strong>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu
              trigger={<button className="bg-white border rounded px-3 py-2 text-sm">{batchId ?? 'Select Batch'}</button>}
              items={availableBatches.map(b => ({ label: b, onSelect: () => { setBatchId(b); } }))}
            />
            {availableDays.length > 0 && (
              <DropdownMenu
                trigger={<button className="bg-white border rounded px-3 py-2 text-sm">{selectedDay ?? 'All Days'}</button>}
                items={[{ label: 'All Days', onSelect: () => setSelectedDay(null) }, ...availableDays.map(d => ({ label: d, onSelect: () => setSelectedDay(d) }))]}
              />
            )}
            <Button onClick={() => runDiag()} variant="default" size="md">{diagLoading ? 'Running...' : 'Analyze'}</Button>
            <Button onClick={runPreview} variant="outline" size="md" disabled={!batchId || previewLoading} className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              {previewLoading ? 'Previewing...' : 'Preview Compact'}
            </Button>
            <ConfirmDialog
              trigger={<Button variant="outline" size="md" className="flex items-center gap-2"><Scissors className="w-4 h-4 text-emerald-400" />Compact Schedule</Button>}
              title="Compress Schedule"
              description="This will attempt to compress daily schedule gaps. Proceed?"
              onConfirm={async () => {
                  try {
                      const res = await compactSchedule(batchId as string, selectedDay, { mode: 'queue' });
                      const taskId = res.task_id || res.taskId || res.task || res.taskId;
                      try { toast.show(`Compression queued (task ${taskId || 'unknown'})`, 'success'); } catch(_){}
                    // Refresh map to reflect any server-side changes
                    try { await data?.refreshMasterMap?.(); } catch(_){ }
                  } catch (e: any) {
                    toast.show?.(`Compression failed: ${e?.message || String(e)}`, 'error');
                  }
                }}
            />
          </div>
        </div>

        {compactPreview && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Preview Proposals</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {compactPreview.proposals?.length || 0} move{(compactPreview.proposals?.length || 0) === 1 ? '' : 's'} prepared for {selectedDay ?? 'all days'}.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCompactPreview(null)}
              >
                Dismiss
              </Button>
            </div>
            <div className="p-5">
              {compactPreview.proposals?.length ? (
                <div className="space-y-3">
                  {compactPreview.proposals.map((proposal: any) => {
                    const session = batchDayClasses.find(s => String(s.id) === String(proposal.entry_pk));
                    return (
                      <div key={proposal.entry_pk} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {session?.subjectCode || session?.courseName || `Entry ${proposal.entry_pk}`}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {selectedDay ?? 'All Days'} • {formatTime(proposal.orig_start)} → {formatTime(proposal.new_start)} • {proposal.duration}m
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-black tracking-wide text-slate-400">Shift</div>
                          <div className="text-sm font-bold text-emerald-700">
                            {Math.max(0, proposal.orig_start - proposal.new_start)}m earlier
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  No compression opportunities found for the selected scope.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Timeline Visualization */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden mb-8">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                <Clock className="w-4 h-4" />
                Working Hours (08:00 - 18:00)
              </div>
              <div className="text-xs font-bold text-slate-900">Wasted Time: <span className="text-rose-500">{totalWasted}m</span></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Class</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-rose-200 rounded-sm" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Gap</span>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="relative h-24 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
               {/* Time markers */}
               <div className="absolute inset-0 flex divide-x divide-slate-100 pointer-events-none">
                  {Array.from({ length: totalHours + 1 }).map((_, i) => (
                    <div key={i} className="flex-1 h-full pt-1 pr-1 text-right">
                       <span className="text-[8px] font-mono text-slate-300">{(START_HOUR + i).toString().padStart(2, '0')}:00</span>
                    </div>
                  ))}
               </div>

               {/* Sessions and Gaps */}
               <div className="absolute inset-y-0 left-0 right-0 flex items-center px-2">
                  <div className="relative w-full h-12">
                     {batchDayClasses.map(session => {
                        const start = timeToMinutes(session.startTime);
                        const left = ((start - START_HOUR * 60) / (totalHours * 60)) * 100;
                        const width = (session.durationMinutes / (totalHours * 60)) * 100;
                        
                        return (
                          <div 
                            key={session.id}
                            className="absolute h-full bg-emerald-500 border border-emerald-600 rounded shadow-md flex items-center justify-center text-[10px] font-black text-white px-2 overflow-hidden"
                            style={{ left: `${left}%`, width: `${width}%` }}
                          >
                            {session.subjectCode}
                          </div>
                        );
                     })}

                     {gaps.map((gap, i) => {
                        const left = ((gap.start - START_HOUR * 60) / (totalHours * 60)) * 100;
                        const width = (gap.duration / (totalHours * 60)) * 100;

                        return (
                          <div 
                            key={i}
                            className={cn(
                              "absolute h-full flex flex-col items-center justify-center border-x-2 border-dashed transition-colors",
                              gap.severity === 'high' ? "bg-rose-100 border-rose-300" : "bg-amber-50 border-amber-200"
                            )}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          >
                            {gap.severity === 'high' && <AlertTriangle className="w-3 h-3 text-rose-500 mb-0.5" />}
                            <span className={cn("text-[8px] font-black uppercase", gap.severity === 'high' ? "text-rose-500" : "text-amber-500")}>Wasted</span>
                          </div>
                        );
                     })}
                  </div>
               </div>
            </div>
            
            {diagnostic && diagnosticGaps && diagnosticGaps.length > 0 && (
              <div className="bg-white p-4 border rounded mb-6">
                <h3 className="font-bold mb-2">Detected Gaps</h3>
                <ul className="space-y-2">
                  {diagnosticGaps.map((g: any, idx: number) => (
                    <li key={idx} className="flex justify-between items-center">
                      <div className="text-sm text-slate-700">{g.day} • {formatTime(g.start)} - {formatTime(g.end)} • <strong className="ml-2">{g.gapMinutes}m</strong></div>
                      <div className="flex gap-2">
                        <button onClick={() => toast.show(`Gap on ${g.day}: ${g.gapMinutes} minutes`, 'info')} className="text-xs px-2 py-1 rounded bg-slate-100">Details</button>
                        <button onClick={() => runDiag()} className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700">Re-run</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {gaps.length > 0 && (
              <div className="mt-6 flex items-start gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <Zap className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-900 leading-none mb-1">Opportunity Found</p>
                  <p className="text-xs text-emerald-700/80 leading-relaxed">
                    This batch has <span className="font-bold">{gaps.length} gap{gaps.length > 1 ? 's' : ''}</span> totalling{' '}
                    <span className="font-bold">{totalWasted} minutes</span> of wasted schedule time.
                    Consider compressing sessions to eliminate these gaps.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4">Efficiency Metrics</h3>
            <div className="space-y-4">
              {(() => {
                const totalMins = batchDayClasses.reduce((a, s) => a + (s.durationMinutes || 50), 0);
                const dayStart = batchDayClasses.length ? Math.min(...batchDayClasses.map(s => timeToMinutes(s.startTime))) : START_HOUR * 60;
                const dayEnd = batchDayClasses.length ? Math.max(...batchDayClasses.map(s => timeToMinutes(s.startTime) + (s.durationMinutes || 50))) : END_HOUR * 60;
                const dayLen = dayEnd - dayStart;
                const efficiency = dayLen > 0 ? Math.round((totalMins / dayLen) * 100) : 0;
                const metrics = [
                  { label: 'Schedule Efficiency', value: `${efficiency}%`, pct: efficiency, color: efficiency > 70 ? 'bg-emerald-500' : efficiency > 40 ? 'bg-amber-500' : 'bg-rose-500' },
                  { label: 'Day Length', value: dayLen > 0 ? `${(dayLen / 60).toFixed(1)}h` : '—', pct: Math.min(100, (dayLen / ((END_HOUR - START_HOUR) * 60)) * 100), color: 'bg-amber-500' },
                  { label: 'Wasted Time', value: `${totalWasted}m`, pct: dayLen > 0 ? Math.min(100, (totalWasted / dayLen) * 100) : 0, color: 'bg-rose-500' },
                ];
                return metrics.map(metric => (
                  <div key={metric.label}>
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase mb-1">
                      <span>{metric.label}</span>
                      <span className="text-slate-900">{metric.value}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                      <div className={cn('h-full', metric.color)} style={{ width: `${metric.pct}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/10">
            <h3 className="text-sm font-black uppercase tracking-tight mb-4">Export Timetable</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">Generate a student-optimized PDF containing session summaries, teacher contact cards, and room directions.</p>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={async () => {
                  if (!batchId) return;
                  try {
                    const blob = await downloadBatchTimetable(batchId);
                    const url = window.URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `${batchId}-timetable.pdf`;
                    document.body.appendChild(anchor);
                    anchor.click();
                    anchor.remove();
                    window.URL.revokeObjectURL(url);
                    try { toast.show('PDF download started', 'success'); } catch (_) {}
                  } catch (e: any) {
                    toast.show(`Download failed: ${e?.message || String(e)}`, 'error');
                  }
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-[10px] font-bold uppercase transition-colors"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

