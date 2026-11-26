"use client";

import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});
export const useToast = () => use(ToastContext);

/** iOS-style HUD toast that floats above the tab bar. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const show = useCallback((message: string) => setToast({ message, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast">
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext>
  );
}
