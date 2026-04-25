"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { checkAuth } from "../lib/api";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastCtx {
  push: (kind: ToastKind, message: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({
  children,
  initialAuthed = false,
}: {
  children: React.ReactNode;
  initialAuthed?: boolean;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  void initialAuthed; // reserved for future SSR pass-through

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg px-4 py-2 shadow-lg text-sm text-white backdrop-blur ${
              t.kind === "success"
                ? "bg-emerald-600/95"
                : t.kind === "error"
                  ? "bg-rose-600/95"
                  : "bg-slate-700/95"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** Hook: track authentication state via /api/auth/me. */
export function useAuthState(initial = false): boolean {
  const [authed, setAuthed] = useState<boolean>(initial);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const ok = await checkAuth();
      if (active) setAuthed(ok);
    };
    void refresh();

    const onChange = () => void refresh();
    window.addEventListener("tf-auth-changed", onChange);
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.removeEventListener("tf-auth-changed", onChange);
      window.clearInterval(interval);
    };
  }, []);

  return authed;
}
