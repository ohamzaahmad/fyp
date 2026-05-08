import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { LogIn, Key, GraduationCap, Building2 } from 'lucide-react';
import { motion } from 'motion/react';
import BatchObserver from './BatchObserver.tsx';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      console.error(err);
      alert('Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,#f1f5f9,transparent),radial-gradient(circle_at_bottom_left,#f1f5f9,transparent)]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-900 rounded-[2rem] shadow-2xl mb-6 transform rotate-12">
            <Building2 className="w-10 h-10 text-emerald-400 -rotate-12" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">NexusTime AI</h1>
          <p className="text-slate-500 font-medium mt-2">University Administrative Gateway</p>
        </div>

        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] select-none">
             <Key className="w-32 h-32 text-slate-900" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Identity (Email)</label>
              <div className="relative">
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@uaf.edu"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Access Key</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
                required
              />
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5 text-emerald-400" />
                  <span>Execute Auth Flow</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between">
             <div className="flex gap-4">
                <button 
                  onClick={() => { setEmail('admin@uaf.edu'); setPassword('password'); }}
                  className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest"
                >
                  Admin Demo
                </button>
                <div className="w-[1px] h-3 bg-slate-200 self-center" />
                <button 
                  onClick={() => { setEmail('teacher_nimra@uaf.edu'); setPassword('password'); }}
                  className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest"
                >
                  Teacher Demo
                </button>
             </div>
             <button className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Forgot Code?</button>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-tighter mb-3">Student Batch Observer</p>
          <BatchObserver />
        </div>
      </motion.div>
    </div>
  );
};
