"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, Command, Menu } from "lucide-react";
import { ClusterMenu } from "@/components/layout/cluster-menu";
import { useCommandPalette } from "@/components/command-palette/command-palette-provider";
import { UserPanel } from "@/components/layout/user-panel";
import { useMobileNav } from "@/components/layout/mobile-nav-context";
import { usePing } from "@/lib/api/queries";
import { cn } from "@/lib/utils";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  instances: "Instances",
  cluster: "Cluster",
  configurations: "Configurations",
  templates: "Templates",
  console: "Console",
  metrics: "Metrics",
  settings: "Settings",
  new: "New",
};

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((seg, i) => ({
    label: routeLabels[seg] ?? seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));
}

export function TopBar() {
  const pathname = usePathname();
  const ping = usePing();
  const { setOpen } = useCommandPalette();
  const { toggleSidebar } = useMobileNav();
  const crumbs = buildBreadcrumbs(pathname);
  const connected = ping.isSuccess && ping.data?.status === "ok";

  return (
    <header className="relative z-50 flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b border-cyan-500/[0.08] bg-[#060810]/95 px-3 backdrop-blur-xl sm:gap-4 sm:px-5">
      <button
        type="button"
        onClick={toggleSidebar}
        className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/10 bg-cyan-500/[0.03] text-slate-400 transition-colors hover:bg-cyan-500/[0.08] hover:text-slate-200 md:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 items-center gap-2 font-mono text-xs">
        <span className="hidden font-semibold text-cyan-500/80 sm:inline">universe</span>
        {crumbs.length > 0 && (
          <>
            <span className="hidden text-slate-700 sm:inline">/</span>
            {crumbs.map((crumb) => (
              <span key={crumb.href} className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "truncate",
                    crumb.isLast ? "font-medium text-slate-200" : "text-slate-600",
                  )}
                >
                  {crumb.label}
                </span>
                {!crumb.isLast && <span className="hidden text-slate-700 sm:inline">/</span>}
              </span>
            ))}
          </>
        )}
      </div>

      <div className="mx-auto hidden max-w-sm flex-1 md:block">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open command palette"
          className="flex w-full items-center gap-2 rounded-lg border border-cyan-500/10 bg-cyan-500/[0.03] px-3 py-1.5 text-sm text-slate-600 transition-colors hover:border-cyan-500/20 hover:bg-cyan-500/[0.06]"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-cyan-500/50" />
          <span className="flex-1 text-left">Search resources...</span>
          <kbd className="hidden items-center gap-0.5 rounded border border-cyan-500/10 bg-cyan-500/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-slate-600 sm:flex">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
        <span
          className={cn(
            "hidden items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider lg:flex",
            connected
              ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
              : "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected ? "bg-emerald-400 pulse-dot" : "bg-red-400",
            )}
          />
          {connected ? "sync" : "down"}
        </span>

        <ClusterMenu />

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open command palette"
          className="touch-target flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/10 bg-cyan-500/[0.03] text-slate-500 transition-colors hover:bg-cyan-500/[0.08] hover:text-slate-300 md:hidden"
        >
          <Search className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          className="touch-target relative hidden h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/10 bg-cyan-500/[0.03] text-slate-500 transition-colors hover:bg-cyan-500/[0.08] hover:text-slate-300 sm:flex"
        >
          <Bell className="h-3.5 w-3.5" />
        </button>

        <UserPanel variant="header" />
      </div>
    </header>
  );
}
