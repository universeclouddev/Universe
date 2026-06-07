"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InstanceInfo } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  message: string;
  detail?: string;
  time: string;
  tone: "success" | "warning" | "muted" | "accent";
}

function relativeTime(ts?: string | number | null): string {
  if (ts == null) return "—";
  const ms = typeof ts === "number" ? ts : new Date(ts).getTime();
  if (Number.isNaN(ms)) return "—";
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return `${hr}h`;
}

function instancesToActivity(instances: InstanceInfo[]): ActivityItem[] {
  return instances
    .filter((i) => i.id)
    .map((i) => {
      let message = "Instance updated";
      let tone: ActivityItem["tone"] = "muted";
      if (i.state === "ONLINE") {
        message = "Instance online";
        tone = "success";
      } else if (i.state === "CREATING") {
        message = "Instance creating";
        tone = "accent";
      } else if (i.state === "STOPPED") {
        message = "Instance stopped";
        tone = "muted";
      } else if (i.state === "OFFLINE") {
        message = "Instance offline";
        tone = "warning";
      }
      return {
        id: i.id!,
        message,
        detail: i.configurationName,
        time: relativeTime(i.lastHeartbeat),
        tone,
      };
    })
    .slice(0, 8);
}

const dotColor = {
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  muted: "bg-zinc-600",
  accent: "bg-cyan-400",
};

interface RecentActivityProps {
  instances: InstanceInfo[];
}

export function RecentActivity({ instances }: RecentActivityProps) {
  const items = useMemo(() => instancesToActivity(instances), [instances]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
    >
      <Card className="glow-border h-full overflow-hidden">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-zinc-600">No recent activity</p>
          ) : (
            <ul className="relative space-y-1">
              <div className="absolute bottom-2 left-[3px] top-2 w-px bg-gradient-to-b from-cyan-500/30 via-cyan-500/5 to-transparent" />
              {items.map((item, i) => (
                <motion.li
                  key={item.id}
                  className="relative flex gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-white/[0.02]"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.05, duration: 0.35 }}
                >
                  <span className={cn("relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full", dotColor[item.tone])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-300">
                      {item.message}
                      {item.detail && (
                        <span className="text-zinc-600">
                          {" "}
                          · <span className="font-mono text-zinc-500">{item.detail}</span>
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-[11px] text-zinc-600">{item.id}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-zinc-600">{item.time}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
