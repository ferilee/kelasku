import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

type NotificationType = 'success' | 'info' | 'warning' | 'error';

type Toast = {
  id: number;
  message: string;
  type: NotificationType;
};

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmRequest = ConfirmOptions & { resolve: (value: boolean) => void };

type NotificationContextValue = {
  notify: (message: string, type?: NotificationType) => void;
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const toastStyles: Record<NotificationType, { icon: typeof CheckCircle2; container: string; iconColor: string }> = {
  success: { icon: CheckCircle2, container: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/60', iconColor: 'text-emerald-600 dark:text-emerald-300' },
  info: { icon: Info, container: 'border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/60', iconColor: 'text-blue-600 dark:text-blue-300' },
  warning: { icon: AlertTriangle, container: 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/60', iconColor: 'text-amber-600 dark:text-amber-300' },
  error: { icon: XCircle, container: 'border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/60', iconColor: 'text-rose-600 dark:text-rose-300' },
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message, type }]);
    window.setTimeout(() => dismissToast(id), type === 'error' ? 6000 : 4000);
  }, [dismissToast]);

  const confirm = useCallback((options: ConfirmOptions | string) => new Promise<boolean>((resolve) => {
    setConfirmRequest(typeof options === 'string' ? { message: options, resolve } : { ...options, resolve });
  }), []);

  const resolveConfirm = useCallback((value: boolean) => {
    const request = confirmRequest;
    setConfirmRequest(null);
    request?.resolve(value);
  }, [confirmRequest]);

  useEffect(() => {
    if (!confirmRequest) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') resolveConfirm(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmRequest, resolveConfirm]);

  return (
    <NotificationContext.Provider value={{ notify, confirm }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const style = toastStyles[toast.type];
          const Icon = style.icon;
          return <div key={toast.id} role="alert" className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm text-slate-700 shadow-xl backdrop-blur-sm dark:text-slate-100 ${style.container}`}>
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`} aria-hidden="true" />
            <p className="min-w-0 flex-1 leading-relaxed">{toast.message}</p>
            <button type="button" onClick={() => dismissToast(toast.id)} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-100" aria-label="Tutup notifikasi"><X className="h-4 w-4" /></button>
          </div>;
        })}
      </div>
      {confirmRequest && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation">
        <div role="dialog" aria-modal="true" aria-labelledby="global-confirm-title" className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-start gap-3">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${confirmRequest.danger ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300'}`}><AlertTriangle className="h-5 w-5" aria-hidden="true" /></div>
            <div className="min-w-0"><h2 id="global-confirm-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">{confirmRequest.title || 'Konfirmasi tindakan'}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{confirmRequest.message}</p></div>
          </div>
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => resolveConfirm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">{confirmRequest.cancelLabel || 'Batal'}</button><button type="button" onClick={() => resolveConfirm(true)} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white ${confirmRequest.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}>{confirmRequest.confirmLabel || 'Lanjutkan'}</button></div>
        </div>
      </div>}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
