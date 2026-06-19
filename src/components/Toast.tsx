import { create } from 'zustand';
import { useEffect, type ReactNode } from 'react';
import { X, CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const genToastId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  showToast: (type, message, duration = 3000) => {
    const id = genToastId();
    set({ toasts: [...get().toasts, { id, type, message, duration }] });
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },
  removeToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export function showToast(type: ToastType, message: string, duration?: number) {
  useToastStore.getState().showToast(type, message, duration);
}

const typeStyles: Record<ToastType, { bg: string; icon: JSX.Element }> = {
  success: { bg: 'bg-emerald-500', icon: <CheckCircle2 className="w-5 h-5" /> },
  error: { bg: 'bg-rose-500', icon: <XCircle className="w-5 h-5" /> },
  info: { bg: 'bg-blue-500', icon: <Info className="w-5 h-5" /> },
  warning: { bg: 'bg-amber-500', icon: <AlertTriangle className="w-5 h-5" /> },
};

interface ToastContainerProps {
  toast: ToastItem;
  onClose: () => void;
  index: number;
}

function ToastContainer({ toast, onClose, index }: ToastContainerProps) {
  const style = typeStyles[toast.type];

  return (
    <div
      className={`${style.bg} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[280px] max-w-[380px]`}
      style={{
        animation: 'slideIn 0.3s ease-out',
        animationDelay: `${index * 50}ms`,
        animationFillMode: 'both',
      }}
    >
      <div className="flex-shrink-0">{style.icon}</div>
      <div className="flex-1 text-sm font-medium break-words">{toast.message}</div>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-white/20 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface ToastProviderProps {
  children?: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const { toasts, removeToast } = useToastStore();

  useEffect(() => {
    const styleId = 'toast-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map((toast, idx) => (
          <ToastContainer
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
            index={idx}
          />
        ))}
      </div>
    </>
  );
}

export default ToastProvider;
