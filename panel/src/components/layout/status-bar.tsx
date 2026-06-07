"use client";

import { motion } from "framer-motion";
import { usePing, useInstances, useNodeInfo, useClusterNodes } from "@/lib/api/queries";
import { useAuth } from "@/lib/auth/context";

function formatUptime(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function StatusBar() {
  const { apiUrl } = useAuth();
  const ping = usePing();
  const instances = useInstances();
  const nodeInfo = useNodeInfo();
  const nodes = useClusterNodes();

  const connected = ping.isSuccess;
  const host = apiUrl?.replace(/^https?:\/\//, "").split(":")[0] ?? "—";
  const onlineCount =
    instances.data?.filter((i) => i.state === "ONLINE" || i.state === "CREATING").length ?? 0;
  const totalRam = nodes.data?.reduce((s, n) => s + (n.resources?.usedRamMB ?? 0), 0) ?? 0;

  return (
    <footer className="status-bar fixed bottom-0 right-0 z-40 hidden h-[var(--status-bar-height)] items-center justify-between border-t border-cyan-500/[0.08] bg-[#060810]/90 px-5 font-mono text-[10px] text-slate-600 backdrop-blur-2xl md:flex">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <motion.span
            className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
            animate={
              connected
                ? { scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }
                : { opacity: [1, 0.4, 1] }
            }
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className={connected ? "text-emerald-500/80" : "text-red-400/80"}>
            {connected ? "LINK_OK" : "LINK_DOWN"}
          </span>
        </span>
        <span className="hidden text-slate-700 sm:inline">|</span>
        <span className="hidden sm:inline">
          v<span className="text-slate-500">{nodeInfo.data?.version ?? "0.1.0"}</span>
        </span>
        <span className="hidden text-slate-700 md:inline">|</span>
        <span className="hidden text-slate-500 md:inline">
          {ping.data?.master ? "MASTER" : "WRAPPER"}
        </span>
      </div>

      <div className="flex items-center gap-3 tabular-nums">
        <span className="hidden sm:inline">
          node:<span className="text-cyan-500/70">{ping.data?.nodeId?.slice(0, 8) ?? "—"}</span>
        </span>
        <span className="hidden text-slate-700 lg:inline">|</span>
        <span className="hidden lg:inline">
          cluster:<span className="text-slate-500">{ping.data?.clusterName ?? "—"}</span>
        </span>
        <span className="hidden text-slate-700 xl:inline">|</span>
        <span className="hidden xl:inline">
          up:
          <span className="text-slate-500">
            {nodeInfo.data ? formatUptime(nodeInfo.data.uptimeMs) : "—"}
          </span>
        </span>
        <span className="text-slate-700">|</span>
        <span>
          inst:<span className="text-emerald-500/70">{onlineCount}</span>
          <span className="text-slate-700">/</span>
          <span className="text-slate-500">{instances.data?.length ?? "—"}</span>
        </span>
        <span className="hidden text-slate-700 md:inline">|</span>
        <span className="hidden text-slate-500 md:inline">{totalRam}MB</span>
        <span className="hidden text-slate-700 sm:inline">|</span>
        <span className="hidden text-slate-600 sm:inline">{host}</span>
      </div>
    </footer>
  );
}
