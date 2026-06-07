"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { TerminalPane, appendTerminalLine, writelnToTerminal } from "@/components/terminal/terminal-pane";
import { useUniverseWsAuth } from "@/hooks/use-universe-ws-auth";
import type { Terminal } from "@xterm/xterm";

export function LiveLogTerminal({
  id,
  seedLines,
  logsUnavailable,
}: {
  id: string;
  seedLines: string[];
  logsUnavailable: boolean;
}) {
  const terminalRef = useRef<Terminal | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const [streamStatus, setStreamStatus] = useState<"idle" | "live" | "ended" | "unavailable">(
    logsUnavailable ? "unavailable" : "idle",
  );

  const onMessage = useCallback((data: string) => {
    appendTerminalLine(terminalRef.current, data);
  }, []);

  const onClose = useCallback((event: CloseEvent) => {
    if (event.code === 1003 || event.reason.toLowerCase().includes("no logs")) {
      setStreamStatus("unavailable");
    } else if (event.code !== 1000) {
      setStreamStatus("ended");
    }
  }, []);

  const liveLog = useUniverseWsAuth({
    purpose: "logs",
    path: `/api/instances/${id}/live-log`,
    enabled: terminalReady && !logsUnavailable && streamStatus !== "unavailable",
    onMessage,
    onClose,
  });

  useEffect(() => {
    if (liveLog.connected) {
      setStreamStatus("live");
    }
  }, [liveLog.connected]);

  const onReady = useCallback(
    (terminal: Terminal) => {
      terminalRef.current = terminal;
      setTerminalReady(true);
      terminal.clear();
      if (seedLines.length > 0) {
        for (const line of seedLines) {
          writelnToTerminal(terminal, line);
        }
      } else if (logsUnavailable) {
        writelnToTerminal(terminal, "[logs unavailable for this instance]");
      }
    },
    [seedLines, logsUnavailable],
  );

  const statusLabel =
    streamStatus === "live"
      ? "● Live"
      : streamStatus === "unavailable"
        ? "Logs unavailable"
        : streamStatus === "ended"
          ? "Stream ended"
          : liveLog.credentialsReady
            ? "Connecting..."
            : "Waiting...";

  const statusClass =
    streamStatus === "live"
      ? "text-emerald-400"
      : streamStatus === "unavailable"
        ? "text-amber-400"
        : "text-zinc-500";

  return (
    <div className="h-[400px]">
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
        <span className={statusClass}>{statusLabel}</span>
        {(liveLog.error || liveLog.credError) && (
          <span className="text-red-400">{liveLog.error ?? liveLog.credError}</span>
        )}
      </div>
      <div className="h-[calc(100%-1.5rem)]">
        <TerminalPane readOnly onReady={onReady} />
      </div>
    </div>
  );
}
