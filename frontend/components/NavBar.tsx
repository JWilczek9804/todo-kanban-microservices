"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type CurrentUser, getCurrentUser, logout } from "../lib/api";
import { useAuthState, useToast } from "./Providers";

export default function NavBar({
  initialAuthed = false,
}: {
  initialAuthed?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const authed = useAuthState(initialAuthed);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let active = true;
    if (!authed) {
      setUser(null);
      return;
    }
    void getCurrentUser().then((u) => {
      if (active) setUser(u);
    });
    return () => {
      active = false;
    };
  }, [authed]);

  const handleLogout = async () => {
    await logout();
    toast.push("info", "Wylogowano");
    router.push("/login");
    router.refresh();
  };

  const initials =
    user && (user.first_name || user.last_name)
      ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
      : (user?.email?.charAt(0).toUpperCase() ?? "?");

  return (
    <header className="border-b border-slate-800/60 bg-slate-950/60 backdrop-blur sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link
          href={authed ? "/tasks" : "/login"}
          className="flex items-center gap-2"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold shadow-sm">
            T
          </span>
          <span className="font-semibold tracking-tight text-lg">TaskFlow</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {authed ? (
            <>
              {user && (
                <div className="hidden sm:flex items-center gap-2 pr-2 border-r border-slate-800">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold">
                    {initials}
                  </span>
                  <div className="leading-tight">
                    <div className="text-sm font-medium">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-md border border-slate-700 hover:bg-slate-800 transition"
              >
                Wyloguj
              </button>
            </>
          ) : (
            pathname !== "/login" &&
            pathname !== "/register" && (
              <>
                <Link
                  href="/login"
                  className="px-3 py-1.5 rounded-md hover:bg-slate-800 transition"
                >
                  Logowanie
                </Link>
                <Link
                  href="/register"
                  className="px-3 py-1.5 rounded-md bg-white text-slate-900 hover:bg-slate-200 transition"
                >
                  Rejestracja
                </Link>
              </>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
