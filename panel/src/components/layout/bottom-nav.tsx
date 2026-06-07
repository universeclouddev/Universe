"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { bottomNavItems, navPermission } from "@/lib/panel/navigation";
import { useMobileNav } from "@/components/layout/mobile-nav-context";
import {
  useInstances,
  useClusterNodes,
  useConfigurations,
  useTemplates,
} from "@/lib/api/queries";

export function BottomNav() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const { toggleSidebar } = useMobileNav();
  const instances = useInstances();
  const nodes = useClusterNodes();
  const configurations = useConfigurations();
  const templates = useTemplates();

  const counts = {
    instances: instances.data?.length ?? 0,
    nodes: nodes.data?.length ?? 0,
    configurations: configurations.data?.length ?? 0,
    templates: templates.data?.reduce((n, g) => n + g.templates.length, 0) ?? 0,
    extensions: 0,
    schedules: 0,
  };

  const items = bottomNavItems.filter((item) => hasPermission(navPermission(item.href)));

  return (
    <nav
      className="bottom-nav fixed inset-x-0 bottom-0 z-50 md:hidden"
      aria-label="Primary navigation"
    >
      <div className="flex items-stretch justify-around gap-0.5 px-1 pb-[env(safe-area-inset-bottom,0px)]">
        {items.map(({ href, label, icon: Icon, countKey }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const count = countKey ? counts[countKey] : 0;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "bottom-nav-item relative flex min-h-[var(--bottom-nav-height)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5",
                active ? "bottom-nav-item-active text-teal-300" : "text-slate-500",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {countKey && count > 0 ? (
                  <span className="absolute -right-2 -top-1.5 min-w-[14px] rounded-full bg-teal-500/20 px-1 text-center font-mono text-[9px] tabular-nums text-teal-300 ring-1 ring-teal-500/30">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate text-[10px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={toggleSidebar}
          className="bottom-nav-item flex min-h-[var(--bottom-nav-height)] min-w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-slate-500"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" aria-hidden />
          <span className="text-[10px] font-medium leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
}
