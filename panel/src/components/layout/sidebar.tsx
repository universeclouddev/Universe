"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { Badge, NavBadge } from "@/components/ui/badge";
import { UserPanel } from "@/components/layout/user-panel";
import { navGroups, navPermission } from "@/lib/panel/navigation";
import {
  useInstances,
  useClusterNodes,
  useConfigurations,
  useTemplates,
  useExtensions,
} from "@/lib/api/queries";
import { useSchedules } from "@/lib/api/schedule-queries";

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const { hasPermission } = useAuth();
  const instances = useInstances();
  const nodes = useClusterNodes();
  const configurations = useConfigurations();
  const templates = useTemplates();
  const extensions = useExtensions();
  const panelSchedules = useSchedules();

  const onlineCount =
    instances.data?.filter((i) => i.state === "ONLINE" || i.state === "CREATING").length ?? 0;

  const counts = {
    instances: instances.data?.length ?? 0,
    nodes: nodes.data?.length ?? 0,
    configurations: configurations.data?.length ?? 0,
    templates: templates.data?.reduce((n, g) => n + g.templates.length, 0) ?? 0,
    extensions: extensions.data?.length ?? 0,
    schedules: panelSchedules.data?.length ?? 0,
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-white/[0.06] bg-[var(--card)]/95 backdrop-blur-2xl md:bg-[var(--card)]/90">
      <motion.div
        className="border-b border-white/[0.06] px-4 py-4"
        initial={reducedMotion ? false : { opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <p className="text-sm font-bold tracking-tight">
            <span className="text-gradient">universe</span>
            <span className="text-slate-600">.</span>
          </p>
          <Badge variant="accent" className="mt-0.5 px-1.5 py-0 text-[9px]">
            OPS PANEL
          </Badge>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg ops-data-panel px-2.5 py-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
            Active
          </span>
          <span className="ml-auto font-mono text-[11px] tabular-nums text-teal-300/90">
            {onlineCount}/{counts.instances}
          </span>
        </div>
      </motion.div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3">
        {navGroups.map((group, gi) => {
          const items = group.items.filter((item) => hasPermission(navPermission(item.href)));
          if (items.length === 0) return null;
          return (
            <motion.div
              key={group.label}
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * gi, duration: 0.35 }}
            >
              <p className="mb-1.5 px-2.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {items.map(({ href, label, icon: Icon, countKey }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  const count = countKey ? counts[countKey] : 0;
                  return (
                    <Link key={href} href={href} onClick={onNavigate}>
                      <motion.div
                        className={cn(
                          "group relative flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium md:min-h-0 md:py-2",
                          "transition-[background-color,color,box-shadow] duration-200 ease-out",
                          active
                            ? "nav-active-glow bg-white/[0.06] text-slate-100 ring-1 ring-white/[0.08]"
                            : "text-slate-500 hover:bg-white/[0.03] hover:text-slate-200",
                        )}
                        whileHover={reducedMotion ? undefined : { x: active ? 0 : 3 }}
                        whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors duration-200",
                            active ? "text-teal-300" : "text-slate-600 group-hover:text-slate-400",
                          )}
                        />
                        {label}
                        {countKey && <NavBadge count={count} />}
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] p-2.5">
        <UserPanel variant="sidebar" />
      </div>
    </aside>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className="mb-5 md:mb-6"
      initial={reducedMotion ? false : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">{title}</h1>
            {meta}
          </div>
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
          )}
        </div>
        {actions && (
          <motion.div
            className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
            initial={reducedMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {actions}
          </motion.div>
        )}
      </div>
      <div className="mt-4 h-px bg-gradient-to-r from-teal-400/15 via-violet-400/10 to-transparent" />
    </motion.div>
  );
}

/** @deprecated Use PageHeader instead */
export function DashboardHeader(props: { title: string; description?: string }) {
  return <PageHeader {...props} />;
}
