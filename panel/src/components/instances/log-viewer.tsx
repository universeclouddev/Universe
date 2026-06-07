"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Pause, Play, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { useInstanceLogs } from "@/lib/api/queries";
import type { InstanceLogsResponse } from "@/lib/api/types";
import { useUniverseWsAuth } from "@/hooks/use-universe-ws-auth";
import { cn } from "@/lib/utils";

type LogMode = "tail" | "live";
type StreamStatus = "idle" | "ended" | "unavailable";

interface InstanceLogViewerProps {
  instanceId: string;
  lines?: number;
  className?: string;
}

export function InstanceLogViewer({ instanceId, lines = 200, className }: InstanceLogViewerProps) {
  const logs = useInstanceLogs(instanceId, lines);
  const [mode, setMode] = useState<LogMode>("tail");
  const [paused, setPaused] = useState(false);
  const [liveLines, setLiveLines] = useState<string[]>([]);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [downloading, setDownloading] = useState(false);

  const containerRef = useRef<HTMLPreElement>(null);
  const stickToBottomRef = useRef(true);
  const prevLineCountRef = useRef(0);

  const tailLines = useMemo(() => logs.data?.lines ?? [], [logs.data?.lines]);
  const logsUnavailable = !!logs.error && tailLines.length === 0;
  const displayLines = mode === "tail" ? tailLines : liveLines;

  const onLiveMessage = useCallback((data: string) => {
    setLiveLines((prev) => [...prev, data]);
  }, []);

  const onLiveClose = useCallback((event: CloseEvent) => {
    if (event.code === 1003 || event.reason.toLowerCase().includes("no logs")) {
      setStreamStatus("unavailable");
    } else if (event.code !== 1000) {
      setStreamStatus("ended");
    }
  }, []);

  const liveLog = useUniverseWsAuth({
    purpose: "logs",
    path: `/api/instances/${instanceId}/live-log`,
    enabled: mode === "live" && !logsUnavailable && streamStatus !== "unavailable",
    onMessage: onLiveMessage,
    onClose: onLiveClose,
  });

  const isLiveConnected = mode === "live" && liveLog.connected;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      stickToBottomRef.current = atBottom;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (paused) return;
    const el = containerRef.current;
    if (!el) return;

    const grew = displayLines.length > prevLineCountRef.current;
    prevLineCountRef.current = displayLines.length;

    if (grew && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [displayLines, paused]);

  useEffect(() => {
    prevLineCountRef.current = 0;
    if (!paused) {
      stickToBottomRef.current = true;
    }
  }, [mode, instanceId, paused]);

  function switchMode(next: LogMode) {
    if (next === mode) return;
    if (next === "live") {
      setLiveLines(tailLines);
      setStreamStatus(logsUnavailable ? "unavailable" : "idle");
    }
    setMode(next);
  }

  async function downloadLogs() {
    setDownloading(true);
    try {
      let content: string;
      try {
        const data = await apiFetch<InstanceLogsResponse>(
          `/instances/${instanceId}/logs?lines=10000`,
        );
        content = data.lines.join("\n");
      } catch {
        content = displayLines.join("\n");
      }

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${instanceId}-logs.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const statusLabel =
    mode === "tail"
      ? logs.isFetching
        ? "Refreshing…"
        : `${displayLines.length} lines`
      : isLiveConnected
        ? "● Live"
        : streamStatus === "unavailable"
          ? "Logs unavailable"
          : streamStatus === "ended"
            ? "Stream ended"
            : liveLog.credentialsReady
              ? "Connecting…"
              : "Waiting…";

  const statusClass =
    isLiveConnected
      ? "text-emerald-400"
      : mode === "live" && streamStatus === "unavailable"
        ? "text-amber-400"
        : "text-zinc-500";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className={statusClass}>{statusLabel}</span>
          {mode === "live" && (liveLog.error || liveLog.credError) && (
            <span className="text-red-400">{liveLog.error ?? liveLog.credError}</span>
          )}
          {paused && <span className="text-zinc-500">Auto-scroll paused</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={mode === "tail" ? "default" : "outline"}
            size="sm"
            onClick={() => switchMode("tail")}
          >
            Tail
          </Button>
          <Button
            variant={mode === "live" ? "default" : "outline"}
            size="sm"
            onClick={() => switchMode("live")}
          >
            <Radio className="h-3.5 w-3.5" />
            Live
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPaused((p) => !p);
              if (paused) {
                stickToBottomRef.current = true;
                const el = containerRef.current;
                if (el) el.scrollTop = el.scrollHeight;
              }
            }}
            title={paused ? "Resume auto-scroll" : "Pause auto-scroll"}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadLogs}
            disabled={downloading || displayLines.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? "Downloading…" : "Download"}
          </Button>
        </div>
      </div>

      <pre
        ref={containerRef}
        className="max-h-[400px] overflow-auto rounded-xl border border-white/[0.06] bg-[#0f1117] p-4 font-mono text-xs text-zinc-400 whitespace-pre-wrap break-all"
      >
        {logs.isLoading && displayLines.length === 0 && "Loading logs…"}
        {logsUnavailable && displayLines.length === 0 && "No logs available for this instance."}
        {displayLines.length > 0
          ? displayLines.join("\n")
          : !logs.isLoading && !logsUnavailable
            ? "No log lines yet."
            : null}
      </pre>
    </div>
  );
}
