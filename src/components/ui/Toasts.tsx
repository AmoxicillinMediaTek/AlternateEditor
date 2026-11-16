"use client";

import { useEffect } from "react";
import { Icon } from "./Icon";
import { useStore, useStoreApi } from "@/lib/workspace/store";
import type { Toast } from "@/lib/workspace/types";

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.tone === "error" ? 6500 : 3800);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.tone, onDismiss]);

  return (
    <div
      className={`toast toast-${toast.tone}`}
      role={toast.tone === "error" ? "alert" : "status"}
    >
      <span className="toast-icon" aria-hidden="true">
        <Icon
          name={toast.tone === "success" ? "check" : toast.tone === "error" ? "alert" : "info"}
          size={16}
        />
      </span>
      <p className="toast-message">{toast.message}</p>
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss message"
        onClick={() => onDismiss(toast.id)}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((state) => state.toasts);
  const store = useStoreApi();
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={(id) => store.dismissToast(id)} />
      ))}
    </div>
  );
}
