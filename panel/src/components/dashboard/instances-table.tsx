"use client";



import { useMemo, useState } from "react";

import Link from "next/link";

import { motion } from "framer-motion";

import { LayoutGrid, List, MoreHorizontal, Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { InstanceStateBadge } from "@/components/ui/badge";

import { Input } from "@/components/ui/input";

import { cn } from "@/lib/utils";

import type { InstanceInfo, InstanceState } from "@/lib/api/types";



type FilterTab = "all" | "online" | "stopped";

type Density = "comfortable" | "compact" | "dense";



interface InstancesTableProps {

  instances: InstanceInfo[];

  loading?: boolean;

  compact?: boolean;

  density?: Density;

  showDensityToggle?: boolean;

  onDelete?: (id: string, name?: string) => void;

}



const densityStyles: Record<Density, { row: string; cell: string; header: string }> = {

  comfortable: { row: "", cell: "px-5 py-3.5", header: "px-5 py-3" },

  compact: { row: "", cell: "px-4 py-2.5", header: "px-4 py-2.5" },

  dense: { row: "text-xs", cell: "px-3 py-1.5", header: "px-3 py-2" },

};



export function InstancesTable({

  instances,

  loading,

  compact = false,

  density: densityProp,

  showDensityToggle = false,

  onDelete,

}: InstancesTableProps) {

  const [filter, setFilter] = useState<FilterTab>("all");

  const [search, setSearch] = useState("");

  const [density, setDensity] = useState<Density>(densityProp ?? (compact ? "compact" : "comfortable"));



  const effectiveDensity = densityProp ?? density;

  const styles = densityStyles[effectiveDensity];

  const hideNode = compact || effectiveDensity === "dense";

  const hideRam = compact;



  const filtered = useMemo(() => {

    let list = instances;

    if (filter === "online") {

      list = list.filter((i) => i.state === "ONLINE" || i.state === "CREATING");

    } else if (filter === "stopped") {

      list = list.filter((i) => i.state === "STOPPED" || i.state === "OFFLINE");

    }

    if (search.trim()) {

      const q = search.toLowerCase();

      list = list.filter(

        (i) =>

          i.id?.toLowerCase().includes(q) ||

          i.configurationName?.toLowerCase().includes(q),

      );

    }

    return list;

  }, [instances, filter, search]);



  const tabs: { id: FilterTab; label: string; count: number }[] = [

    { id: "all", label: "all", count: instances.length },

    {

      id: "online",

      label: "online",

      count: instances.filter((i) => i.state === "ONLINE" || i.state === "CREATING").length,

    },

    {

      id: "stopped",

      label: "stopped",

      count: instances.filter((i) => i.state === "STOPPED" || i.state === "OFFLINE").length,

    },

  ];



  const totalRam = filtered.reduce((s, i) => s + (i.allocatedRamMB ?? 0), 0);

  const colSpan = 2 + (hideNode ? 0 : 1) + (hideRam ? 0 : 1) + 3;



  return (

    <Card className="glow-border overflow-hidden">

      <CardHeader className="flex-col items-stretch gap-3 space-y-0 border-b border-cyan-500/[0.06] pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="font-mono text-sm uppercase tracking-wider text-cyan-400/90">
            Instances
          </CardTitle>
          <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] tabular-nums text-cyan-300/80 ring-1 ring-cyan-500/15">
            {filtered.length} rows
          </span>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter ID, config..."
              className="h-10 w-full pl-8 font-mono text-xs sm:h-8 sm:w-40"
            />
          </div>
          <div className="flex w-full rounded-lg border border-cyan-500/10 bg-cyan-500/[0.02] p-0.5 sm:w-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "touch-target min-h-10 flex-1 rounded-md px-2.5 py-2 font-mono text-[11px] font-medium capitalize transition-colors sm:min-h-0 sm:flex-none sm:py-1",
                  filter === tab.id
                    ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/20"
                    : "text-slate-600 hover:text-slate-400",
                )}
              >
                {tab.label}
                <span className="ml-1 tabular-nums text-slate-600">{tab.count}</span>
              </button>
            ))}
          </div>
          {showDensityToggle && !densityProp && (
            <div className="hidden rounded-lg border border-cyan-500/10 p-0.5 sm:flex">

              {(

                [

                  { id: "comfortable" as const, icon: LayoutGrid, title: "Comfortable" },

                  { id: "compact" as const, icon: List, title: "Compact" },

                  { id: "dense" as const, icon: List, title: "Dense" },

                ] as const

              ).map(({ id, icon: Icon, title }) => (

                <button

                  key={id}

                  type="button"

                  title={title}

                  onClick={() => setDensity(id)}

                  className={cn(

                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors",

                    density === id

                      ? "bg-cyan-500/15 text-cyan-300"

                      : "text-slate-600 hover:text-slate-400",

                  )}

                >

                  <Icon className="h-3.5 w-3.5" />

                </button>

              ))}

            </div>

          )}

        </div>

      </CardHeader>

      <CardContent className="p-0">
        <div className="space-y-2 p-3 md:hidden">
          {loading && (
            <p className="py-10 text-center font-mono text-sm text-slate-600">Loading instances...</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="py-10 text-center font-mono text-sm text-slate-600">
              No instances match this filter
            </p>
          )}
          {!loading &&
            filtered.map((instance, i) => (
              <motion.div
                key={instance.id ?? `mobile-${i}`}
                className="rounded-xl border border-cyan-500/10 bg-cyan-500/[0.02] p-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/instances/${instance.id}`} className="group min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          instance.state === "ONLINE" && "bg-emerald-400 pulse-dot",
                          instance.state === "CREATING" && "bg-amber-400",
                          instance.state === "STOPPED" && "bg-slate-600",
                          instance.state === "OFFLINE" && "bg-amber-500/70",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-200 group-hover:text-cyan-300">
                          {instance.configurationName ?? "instance"}
                        </p>
                        <p className="truncate font-mono text-[10px] text-slate-600">{instance.id}</p>
                      </div>
                    </div>
                  </Link>
                  {instance.state && (
                    <InstanceStateBadge state={instance.state as InstanceState} />
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-md border border-cyan-500/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[9px] uppercase tracking-wide text-slate-600">Port</p>
                    <p className="font-mono text-cyan-400/80">{instance.allocatedPort ?? "—"}</p>
                  </div>
                  {!hideRam && (
                    <div className="rounded-md border border-cyan-500/10 bg-black/20 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-wide text-slate-600">RAM</p>
                      <p className="font-mono text-slate-400">{instance.allocatedRamMB ?? "—"} MB</p>
                    </div>
                  )}
                  {!hideNode && (
                    <div className="col-span-2 rounded-md border border-cyan-500/10 bg-black/20 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-wide text-slate-600">Node</p>
                      <p className="truncate font-mono text-slate-400">
                        {instance.wrapperNodeId?.slice(0, 8) ?? "—"}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/instances/${instance.id}`}
                    className="touch-target flex flex-1 items-center justify-center rounded-lg border border-cyan-500/15 bg-cyan-500/10 px-3 text-sm font-medium text-cyan-300"
                  >
                    Open
                  </Link>
                  {onDelete && instance.id && (
                    <button
                      type="button"
                      onClick={() => onDelete(instance.id!, instance.configurationName)}
                      className="touch-target flex min-w-[3.25rem] items-center justify-center rounded-lg border border-red-500/15 bg-red-500/10 px-3 text-sm font-medium text-red-400"
                      title="Delete instance"
                    >
                      Stop
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
        </div>

        <div className="hidden overflow-x-auto md:block">

          <table className={cn("w-full text-sm", styles.row)}>

            <thead>

              <tr className="border-b border-cyan-500/[0.06] bg-cyan-500/[0.02] text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">

                <th className={styles.header}>Name</th>

                <th className={styles.header}>Group</th>

                {!hideNode && <th className={styles.header}>Node</th>}

                <th className={styles.header}>Port</th>

                {!hideRam && <th className={styles.header}>RAM</th>}

                <th className={styles.header}>Status</th>

                <th className={cn(styles.header, "w-10")} />

              </tr>

            </thead>

            <tbody>

              {loading && (

                <tr>

                  <td colSpan={colSpan} className="px-5 py-12 text-center font-mono text-sm text-slate-600">

                    Loading instances...

                  </td>

                </tr>

              )}

              {!loading && filtered.length === 0 && (

                <tr>

                  <td colSpan={colSpan} className="px-5 py-12 text-center font-mono text-sm text-slate-600">

                    No instances match this filter

                  </td>

                </tr>

              )}

              {filtered.map((instance, i) => (

                <motion.tr

                  key={instance.id ?? "unknown"}

                  className="border-b border-cyan-500/[0.04] transition-colors hover:bg-cyan-500/[0.03]"

                  initial={{ opacity: 0, x: -6 }}

                  animate={{ opacity: 1, x: 0 }}

                  transition={{ delay: i * 0.02, duration: 0.25 }}

                >

                  <td className={styles.cell}>

                    <Link href={`/instances/${instance.id}`} className="group block">

                      <div className="flex items-center gap-2">

                        <span

                          className={cn(

                            "h-1.5 w-1.5 shrink-0 rounded-full",

                            instance.state === "ONLINE" && "bg-emerald-400 pulse-dot",

                            instance.state === "CREATING" && "bg-amber-400",

                            instance.state === "STOPPED" && "bg-slate-600",

                            instance.state === "OFFLINE" && "bg-amber-500/70",

                          )}

                        />

                        <div>

                          <p className="font-medium text-slate-200 group-hover:text-cyan-300 transition-colors">

                            {instance.configurationName ?? "instance"}

                          </p>

                          <p className="font-mono text-[10px] text-slate-600">{instance.id}</p>

                        </div>

                      </div>

                    </Link>

                  </td>

                  <td className={styles.cell}>

                    <span className="rounded border border-cyan-500/10 bg-cyan-500/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-slate-500">

                      {instance.configurationName}

                    </span>

                  </td>

                  {!hideNode && (

                    <td className={cn(styles.cell, "font-mono text-[11px] text-slate-500")}>

                      {instance.wrapperNodeId?.slice(0, 8) ?? "—"}

                    </td>

                  )}

                  <td className={cn(styles.cell, "font-mono text-[11px] text-cyan-400/80")}>

                    {instance.allocatedPort ?? "—"}

                  </td>

                  {!hideRam && (

                    <td className={cn(styles.cell, "font-mono text-[11px] text-slate-500")}>

                      {instance.allocatedRamMB ?? "—"} MB

                    </td>

                  )}

                  <td className={styles.cell}>

                    {instance.state && (

                      <InstanceStateBadge state={instance.state as InstanceState} />

                    )}

                  </td>

                  <td className={styles.cell}>

                    <div className="flex items-center gap-1">

                      <Link

                        href={`/instances/${instance.id}`}

                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-cyan-500/10 hover:text-cyan-400"

                      >

                        <MoreHorizontal className="h-4 w-4" />

                      </Link>

                      {onDelete && instance.id && (

                        <button

                          type="button"

                          onClick={() => onDelete(instance.id!, instance.configurationName)}

                          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-red-500/10 hover:text-red-400"

                          title="Delete instance"

                        >

                          ×

                        </button>

                      )}

                    </div>

                  </td>

                </motion.tr>

              ))}

            </tbody>

          </table>

        </div>



        {!loading && filtered.length > 0 && (

          <div className="flex flex-wrap items-center gap-4 border-t border-cyan-500/[0.06] bg-cyan-500/[0.02] px-4 py-2 font-mono text-[10px] text-slate-600">

            <span>

              showing <span className="text-cyan-400/80">{filtered.length}</span> of{" "}

              <span className="text-slate-500">{instances.length}</span>

            </span>

            <span className="text-slate-700">|</span>

            <span>

              ram: <span className="text-slate-500">{totalRam} MB</span>

            </span>

            <span className="text-slate-700">|</span>

            <span>

              online:{" "}

              <span className="text-emerald-500/80">

                {filtered.filter((i) => i.state === "ONLINE" || i.state === "CREATING").length}

              </span>

            </span>

          </div>

        )}

      </CardContent>

    </Card>

  );

}


