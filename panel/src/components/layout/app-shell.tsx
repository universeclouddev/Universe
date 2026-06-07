"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { StatusBar } from "@/components/layout/status-bar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AmbientBackground } from "@/components/layout/ambient-background";
import { MobileNavProvider, useMobileNav } from "@/components/layout/mobile-nav-context";
import { CommandPaletteProvider } from "@/components/command-palette/command-palette-provider";
import { AlertEvaluator } from "@/components/layout/alert-evaluator";
import { cn } from "@/lib/utils";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { sidebarOpen, closeSidebar } = useMobileNav();

  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSidebar();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen, closeSidebar]);

  useEffect(() => {
    document.body.classList.toggle("mobile-nav-open", sidebarOpen);
    return () => document.body.classList.remove("mobile-nav-open");
  }, [sidebarOpen]);

  return (
    <div className="app-mesh ops-shell relative flex h-[100dvh] overflow-hidden">
      <AlertEvaluator />
      <AmbientBackground />

      <div className="relative z-10 hidden h-full w-[var(--sidebar-width)] shrink-0 md:flex">
        <Sidebar />
      </div>

      <div
        className={cn(
          "fixed inset-0 z-[60] md:hidden",
          sidebarOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!sidebarOpen}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
            sidebarOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={closeSidebar}
          aria-label="Close navigation menu"
          tabIndex={sidebarOpen ? 0 : -1}
        />
        <div
          className={cn(
            "mobile-sidebar-drawer absolute inset-y-0 left-0 w-[min(18rem,88vw)] shadow-2xl transition-transform duration-300 ease-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar onNavigate={closeSidebar} />
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="main-content relative z-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </main>
        <StatusBar />
        <BottomNav />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavProvider>
      <CommandPaletteProvider>
        <AppShellInner>{children}</AppShellInner>
      </CommandPaletteProvider>
    </MobileNavProvider>
  );
}
