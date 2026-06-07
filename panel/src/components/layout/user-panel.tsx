"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronUp, LogOut, Settings, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type PanelRole } from "@/lib/panel/permissions";

function userInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function roleBadgeVariant(role: PanelRole) {
  if (role === "operator") return "success" as const;
  if (role === "admin") return "accent" as const;
  return "muted" as const;
}

interface UserPanelProps {
  /** Sidebar: full-width row at bottom. Header: avatar-only in top bar. */
  variant?: "sidebar" | "header";
}

export function UserPanel({ variant = "sidebar" }: UserPanelProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { user, logout, hasPermission } = useAuth();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  if (!user) return null;

  const initials = userInitials(user.name);
  const isSidebar = variant === "sidebar";

  return (
    <div
      ref={rootRef}
      className={cn("relative", isSidebar ? "w-full" : "shrink-0")}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex items-center gap-3 transition-colors",
          isSidebar
            ? cn(
                "w-full rounded-xl border px-2.5 py-2.5 text-left",
                open
                  ? "border-white/[0.1] bg-white/[0.06]"
                  : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.04]",
              )
            : cn(
                "h-9 w-9 justify-center rounded-xl border",
                open
                  ? "border-white/[0.12] bg-white/[0.06]"
                  : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]",
              ),
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-700 font-bold text-slate-950",
            isSidebar ? "h-9 w-9 text-xs" : "h-7 w-7 text-[10px] rounded-md",
          )}
        >
          {initials}
        </div>

        {isSidebar && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-200">{user.name}</p>
              <p className="truncate text-[11px] text-zinc-500">{user.email}</p>
            </div>
            <ChevronUp
              className={cn(
                "h-4 w-4 shrink-0 text-zinc-600 transition-transform",
                open && "rotate-180",
              )}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-[100] w-64 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0f1117] shadow-2xl shadow-black/40",
            isSidebar
              ? "bottom-[calc(100%+0.5rem)] left-0"
              : "right-0 top-[calc(100%+0.5rem)]",
          )}
        >
          <div className="border-b border-white/[0.06] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-700 text-sm font-bold text-slate-950">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-100">{user.name}</p>
                <p className="truncate text-xs text-zinc-500">{user.email}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <Badge variant={roleBadgeVariant(user.role)} className="text-[10px]">
                {ROLE_LABELS[user.role]}
              </Badge>
              <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                <Shield className="h-3 w-3" />
                Panel account
              </span>
            </div>
          </div>

          <div className="p-1.5">
            {hasPermission("settings.view") && (
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-zinc-100"
              >
                <Settings className="h-4 w-4 text-zinc-500" />
                Settings
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut className="h-4 w-4 text-zinc-500" />
              Sign out
            </button>
          </div>

          <div className="border-t border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-700">universe panel · v0.1.0</p>
          </div>
        </div>
      )}
    </div>
  );
}
