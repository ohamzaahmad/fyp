import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { motion, AnimatePresence } from 'motion/react';

export const BulkImport: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xlsx'))) {
      setFile(droppedFile);
      setStep(2);
    }
  };

  const MAPPING_FIELDS = [
    { source: 'Faculty Name', target: 'facultyName', required: true },
    { source: 'Course ID', target: 'subjectCode', required: true },
    { source: 'Section', target: 'batchId', required: true },
    { source: 'Day', target: 'day', required: true },
    { source: 'Starting Time', target: 'startTime', required: true },
    { source: 'Duration', target: 'duration', required: false },
    { source: 'Location', target: 'roomId', required: false },
  ];

  return (
    <div className="flex-1 p-8 bg-slate-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.25em]">Data Transition Core</span>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mt-1">Bulk Timetable Ingest</h1>
          <p className="text-slate-500 mt-2 font-medium">Map your existing spreadsheet columns to the NexusTime AI Schema.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden">
          <div className="flex border-b border-slate-100">
            {[
              { id: 1, label: 'Upload Data', icon: Upload },
              { id: 2, label: 'Map Columns', icon: FileSpreadsheet },
              { id: 3, label: 'Finalize Ingest', icon: Check },
            ].map((s) => (
              <div 
                key={s.id}
                className={cn(
                  "flex-1 p-6 flex items-center justify-center gap-3 border-r last:border-r-0 transition-colors",
                  step === s.id ? "bg-slate-900 text-white" : "bg-white text-slate-400"
                )}
              >
                <s.icon className={cn("w-5 h-5", step === s.id ? "text-emerald-400" : "text-slate-300")} />
                <span className="text-xs font-black uppercase tracking-widest">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="p-12">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "w-full aspect-[2/1] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 transition-all group cursor-pointer",
                      isDragging ? "bg-emerald-50 border-emerald-500 scale-[0.99]" : "border-slate-200 hover:border-slate-400 bg-slate-50/50"
                    )}
                  >
                    <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-slate-800">Drop your Master Map here</p>
                      <p className="text-sm font-medium text-slate-400">Supports .CSV, .XLSX (Max 50MB)</p>
                    </div>
                    <button className="mt-4 bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-900/10">Browse Files</button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                    <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                    <p className="text-sm font-bold text-amber-900 leading-tight">
                      Spreadsheet detected: <span className="underline italic">Spring_2026_Raw_Data.csv</span>. Please verify the following mappings.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {MAPPING_FIELDS.map((field) => (
                      <div key={field.target} className="flex items-center gap-4 group">
                        <div className="w-48 text-right font-black uppercase text-[10px] text-slate-400 group-hover:text-slate-600 transition-colors">
                          {field.source} {field.required && <span className="text-rose-500">*</span>}
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-200" />
                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between hover:bg-white transition-colors">
                           <span className="text-sm font-bold text-slate-700">{field.target}</span>
                           <select className="bg-transparent border-none outline-none text-[10px] font-black uppercase text-emerald-600">
                             <option>Auto-Mapped: Col {Math.floor(Math.random() * 8)}</option>
                           </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-4 pt-8">
                    <button onClick={() => setStep(1)} className="px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest text-slate-400 hover:text-slate-800">Back</button>
                    <button onClick={() => setStep(3)} className="bg-emerald-500 text-white px-10 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-600 shadow-xl shadow-emerald-500/20">Verify & Commit</button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/20">
                    <Check className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Ingest Processing...</h2>
                  <p className="max-w-md text-slate-500 font-medium leading-relaxed mb-8">AI core is currently parsing 1,402 distinct constraints and building the Relational Load Table.</p>
                  <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden mb-12">
                    <motion.div 
                      className="h-full bg-emerald-500"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2, ease: "easeInOut" }}
                    />
                  </div>
                  <button className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 shadow-2xl shadow-slate-900/10">Proceed to Master Grid</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
