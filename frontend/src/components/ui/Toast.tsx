import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ToastType = 'info' | 'success' | 'error';
type ToastMessage = { id: string; text: string; type: ToastType };

type ToastContextValue = {
  show: (text: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((text: string, type: ToastType = 'info') => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const msg: ToastMessage = { id, text, type };
    setToasts(prev => [msg, ...prev].slice(0, 6));
    // auto-dismiss
    window.setTimeout(() => remove(id), 4500);
  }, [remove]);

  const icons: Record<ToastType, string> = { info: 'ℹ️', success: '✔️', error: '⚠️' };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full items-end pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto w-full max-w-sm flex items-start gap-3 px-4 py-2 rounded-lg shadow-lg text-sm font-bold text-white select-none transform transition-all`}
            style={{ background: undefined }}
          >
            <div className={`${t.type === 'success' ? 'bg-emerald-500' : t.type === 'error' ? 'bg-rose-500' : 'bg-slate-700'} rounded-lg px-3 py-2 flex items-center gap-3 w-full`}>
              <div className="text-lg leading-none">{icons[t.type]}</div>
              <div className="flex-1 text-left">{t.text}</div>
              <button aria-label="Dismiss" onClick={() => remove(t.id)} className="ml-3 text-white/90 font-black">×</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export default ToastProvider;
