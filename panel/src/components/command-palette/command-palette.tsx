"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  FileJson,
  FolderOpen,
  LayoutDashboard,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Terminal,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/context";
import {
  useConfigurations,
  useInstances,
  useTemplates,
} from "@/lib/api/queries";
import { ROUTE_PERMISSIONS, type PanelPermission } from "@/lib/panel/permissions";
import { cn } from "@/lib/utils";
import { useCommandPalette } from "@/components/command-palette/command-palette-provider";

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  group: string;
  icon: LucideIcon;
  keywords?: string[];
  disabled?: boolean;
  run: () => void | Promise<void>;
};

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: ["home", "overview"] },
  { href: "/instances", label: "Instances", icon: Server, keywords: ["servers", "deploy"] },
  {
    href: "/configurations",
    label: "Configurations",
    icon: FileJson,
    keywords: ["config", "json"],
  },
  { href: "/templates", label: "Templates", icon: FolderOpen, keywords: ["files", "zip"] },
  { href: "/cluster", label: "Cluster", icon: Network, keywords: ["nodes", "wrapper"] },
  { href: "/console", label: "Console", icon: Terminal, keywords: ["shell", "command"] },
  { href: "/metrics", label: "Metrics", icon: BarChart3, keywords: ["prometheus", "stats"] },
  { href: "/settings", label: "Settings", icon: Settings, keywords: ["preferences", "admin"] },
];

const INSTANCE_ID_PATTERN = /^[a-zA-Z0-9]{6}$/;

function matchesQuery(query: string, item: Pick<CommandItem, "label" | "keywords" | "description">) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts = [item.label, item.description ?? "", ...(item.keywords ?? [])];
  const haystack = parts.join(" ").toLowerCase();
  if (haystack.includes(q)) return true;
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

function groupOrder(group: string) {
  const order = ["Quick actions", "Go to", "Instances", "Configurations", "Templates", "Clusters"];
  const index = order.indexOf(group);
  return index === -1 ? order.length : index;
}

export function CommandPalette() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { open, setOpen, openTemplateImport } = useCommandPalette();
  const {
    clusters,
    activeClusterId,
    hasPermission,
    canAccessRoute,
    switchCluster,
  } = useAuth();

  const instances = useInstances();
  const configurations = useConfigurations();
  const templates = useTemplates();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [switchingClusterId, setSwitchingClusterId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, [setOpen]);

  const navigate = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const runWithPermission = useCallback(
    (permission: PanelPermission | undefined, action: () => void | Promise<void>) => {
      if (permission && !hasPermission(permission)) {
        toast.error("You don't have permission for this action");
        return;
      }
      void Promise.resolve(action());
    },
    [hasPermission],
  );

  const items = useMemo(() => {
    const list: CommandItem[] = [];
    const trimmed = query.trim();
    const instanceIdCandidate = trimmed.replace(/\s/g, "");

    if (INSTANCE_ID_PATTERN.test(instanceIdCandidate)) {
      list.push({
        id: `instance-open-${instanceIdCandidate}`,
        label: `Open instance ${instanceIdCandidate}`,
        description: "Navigate to instance detail",
        group: "Quick actions",
        icon: Server,
        keywords: ["goto", "id", instanceIdCandidate],
        disabled: !hasPermission("instances.read"),
        run: () => navigate(`/instances/${instanceIdCandidate.toLowerCase()}`),
      });
    }

    list.push({
      id: "action-refresh",
      label: "Refresh data",
      description: "Reload instances, nodes, templates, and configurations",
      group: "Quick actions",
      icon: RefreshCw,
      keywords: ["reload", "sync", "invalidate"],
      disabled: refreshing,
      run: async () => {
        setRefreshing(true);
        try {
          await queryClient.invalidateQueries();
          toast.success("Data refreshed");
          close();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Refresh failed");
        } finally {
          setRefreshing(false);
        }
      },
    });

    if (hasPermission("instances.manage")) {
      list.push({
        id: "action-new-instance",
        label: "New instance",
        description: "Deploy from a configuration",
        group: "Quick actions",
        icon: Plus,
        keywords: ["create", "deploy", "server"],
        run: () => navigate("/instances?create=1"),
      });
    }

    if (hasPermission("templates.manage")) {
      list.push({
        id: "action-import-template",
        label: "Import template",
        description: "Upload a zip into ./templates/",
        group: "Quick actions",
        icon: Upload,
        keywords: ["upload", "zip", "template"],
        run: () => {
          close();
          openTemplateImport();
        },
      });
    }

    if (hasPermission("configurations.manage")) {
      list.push({
        id: "action-new-configuration",
        label: "New configuration",
        description: "Create an instance configuration",
        group: "Quick actions",
        icon: FileJson,
        keywords: ["create", "config"],
        run: () => navigate("/configurations/new"),
      });
    }

    for (const nav of NAV_ITEMS) {
      const permission = ROUTE_PERMISSIONS[nav.href];
      if (!canAccessRoute(nav.href)) continue;
      list.push({
        id: `nav-${nav.href}`,
        label: nav.label,
        description: nav.href,
        group: "Go to",
        icon: nav.icon,
        keywords: nav.keywords,
        disabled: permission ? !hasPermission(permission) : false,
        run: () => navigate(nav.href),
      });
    }

    for (const instance of instances.data ?? []) {
      const id = instance.id ?? "";
      list.push({
        id: `instance-${id}`,
        label: instance.configurationName ? `${id} · ${instance.configurationName}` : id,
        description: instance.state ?? undefined,
        group: "Instances",
        icon: Server,
        keywords: [id, instance.configurationName ?? "", instance.state ?? ""],
        disabled: !hasPermission("instances.read"),
        run: () => navigate(`/instances/${id}`),
      });
    }

    for (const config of configurations.data ?? []) {
      const name = config.name;
      if (!name) continue;
      list.push({
        id: `configuration-${name}`,
        label: name,
        description: "Configuration",
        group: "Configurations",
        icon: FileJson,
        keywords: [name],
        disabled: !hasPermission("configurations.read"),
        run: () => navigate(`/configurations/${encodeURIComponent(name)}`),
      });
    }

    for (const group of templates.data ?? []) {
      for (const template of group.templates) {
        const path = `${group.group}/${template.name}`;
        list.push({
          id: `template-${path}`,
          label: path,
          description: "Template",
          group: "Templates",
          icon: FolderOpen,
          keywords: [group.group, template.name, path],
          disabled: !hasPermission("templates.read"),
          run: () =>
            navigate(
              `/templates/${encodeURIComponent(group.group)}/${encodeURIComponent(template.name)}`,
            ),
        });
      }
    }

    for (const cluster of clusters) {
      const active = cluster.id === activeClusterId;
      list.push({
        id: `cluster-${cluster.id}`,
        label: active ? `${cluster.name} (active)` : cluster.name,
        description: cluster.apiUrl,
        group: "Clusters",
        icon: Network,
        keywords: [cluster.name, cluster.apiUrl, "switch", "cluster"],
        disabled: active || switchingClusterId !== null,
        run: async () => {
          if (active) return;
          setSwitchingClusterId(cluster.id);
          try {
            await switchCluster(cluster.id);
            toast.success(`Switched to ${cluster.name}`);
            close();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to switch cluster");
          } finally {
            setSwitchingClusterId(null);
          }
        },
      });
    }

    return list.filter((item) => matchesQuery(query, item));
  }, [
    query,
    hasPermission,
    canAccessRoute,
    instances.data,
    configurations.data,
    templates.data,
    clusters,
    activeClusterId,
    switchingClusterId,
    refreshing,
    navigate,
    close,
    openTemplateImport,
    queryClient,
    switchCluster,
  ]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();
    for (const item of items) {
      const bucket = groups.get(item.group) ?? [];
      bucket.push(item);
      groups.set(item.group, bucket);
    }
    return [...groups.entries()].sort(([a], [b]) => groupOrder(a) - groupOrder(b));
  }, [items]);

  const flatItems = useMemo(
    () => groupedItems.flatMap(([, groupItems]) => groupItems),
    [groupedItems],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const activeEl = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (flatItems.length === 0 ? 0 : (index + 1) % flatItems.length));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) =>
          flatItems.length === 0 ? 0 : (index - 1 + flatItems.length) % flatItems.length,
        );
        return;
      }

      if (event.key === "Enter" && flatItems.length > 0) {
        event.preventDefault();
        const item = flatItems[activeIndex];
        if (item && !item.disabled) {
          void item.run();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, flatItems, activeIndex, close]);

  if (!open) return null;

  let runningIndex = 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 p-4 pt-[min(18vh,8rem)] backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="glass-panel glow-border w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 duration-200"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-cyan-400/70" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, instances, clusters, actions…"
            className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            autoComplete="off"
            spellCheck={false}
          />
          {(refreshing || switchingClusterId) && (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          )}
          <kbd className="hidden rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-500 sm:inline">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[min(24rem,50vh)] overflow-y-auto p-2">
          {flatItems.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-zinc-500">No matching commands</p>
          ) : (
            groupedItems.map(([group, groupItems]) => (
              <div key={group} className="mb-2 last:mb-0">
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {groupItems.map((item) => {
                    const index = runningIndex++;
                    const active = index === activeIndex;
                    const Icon = item.icon;
                    const clusterBusy = item.id.startsWith("cluster-") && switchingClusterId !== null;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          data-index={index}
                          disabled={item.disabled}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => {
                            if (item.disabled) return;
                            runWithPermission(undefined, item.run);
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                            active
                              ? "bg-cyan-500/10 text-zinc-100 ring-1 ring-cyan-500/20"
                              : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200",
                            item.disabled && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              active ? "text-cyan-300" : "text-zinc-600",
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{item.label}</span>
                            {item.description && (
                              <span className="block truncate text-xs text-zinc-600">
                                {item.description}
                              </span>
                            )}
                          </span>
                          {clusterBusy && item.id === `cluster-${switchingClusterId}` && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2 text-[10px] text-zinc-600">
          <span>Type a 6-character instance ID to jump directly</span>
          <span className="hidden gap-2 sm:flex">
            <span>
              <kbd className="rounded border border-white/[0.08] px-1">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="rounded border border-white/[0.08] px-1">↵</kbd> run
            </span>
          </span>
        </div>
      </div>

      <button
        type="button"
        className="absolute inset-0 -z-10 cursor-default"
        aria-label="Close command palette"
        onClick={close}
      />
    </div>
  );
}
