import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { LogIn, Key, Building2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BatchObserver from './BatchObserver.tsx';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const data = useData();

  const appName = data.systemSettings?.app_name || 'NexusTime AI';
  const orgName = data.systemSettings?.org_name || 'University Administrative Gateway';
  const logoUrl = data.systemSettings?.logo_url;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      console.error(err);
      setError('Invalid username or password.');
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
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white border border-slate-100 rounded-[2rem] shadow-2xl mb-6 transform rotate-3 overflow-hidden p-2">
            {logoUrl ? (
              <img src={logoUrl} alt={appName} className="w-full h-full object-contain -rotate-3" />
            ) : (
              <div className="w-full h-full bg-slate-900 flex items-center justify-center rounded-2xl">
                 <Building2 className="w-10 h-10 text-emerald-400 -rotate-3" />
              </div>
            )}
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">{appName}</h1>
          <p className="text-slate-500 font-medium mt-2">{orgName}</p>
        </div>

        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] select-none pointer-events-none">
             <Key className="w-32 h-32 text-slate-900" />
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-xs font-bold"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Username</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Username or Email"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
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
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between">
             <div className="flex gap-4">
                <button 
                  onClick={() => { setEmail('admin'); setPassword('admin'); }}
                  className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors"
                >
                  Admin Demo
                </button>
                <div className="w-[1px] h-3 bg-slate-200 self-center" />
                <button 
                  onClick={() => { setEmail('seed_teacher'); setPassword('password'); }}
                  className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors"
                >
                  Staff Demo
                </button>
             </div>
             <button className="text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:text-emerald-600 transition-colors">Forgot Password?</button>
          </div>
        </div>

        <div className="mt-12">
          <div className="flex items-center gap-4 mb-4">
             <div className="h-[1px] bg-slate-200 flex-1" />
             <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Student Quick Access</p>
             <div className="h-[1px] bg-slate-200 flex-1" />
          </div>
          <BatchObserver />
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
