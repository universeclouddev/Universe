"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { cn } from "@/lib/utils";

interface TerminalPaneProps {
  className?: string;
  onData?: (data: string) => void;
  onReady?: (terminal: Terminal) => void;
  readOnly?: boolean;
}

export function TerminalPane({ className, onData, onReady, readOnly = false }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const onDataRef = useRef(onData);
  const onReadyRef = useRef(onReady);

  onDataRef.current = onData;
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: "#080b10",
        foreground: "#e2e8f0",
        cursor: "#22d3ee",
        selectionBackground: "rgba(6, 182, 212, 0.35)",
        black: "#0f131c",
        brightBlack: "#475569",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#06b6d4",
        magenta: "#a855f7",
        cyan: "#22d3ee",
        white: "#f1f5f9",
      },
      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      fontSize: 13,
      cursorBlink: !readOnly,
      disableStdin: readOnly,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    if (!readOnly) {
      terminal.onData((data) => onDataRef.current?.(data));
    }

    terminalRef.current = terminal;
    fitRef.current = fitAddon;
    onReadyRef.current?.(terminal);

    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore fit before terminal is fully rendered
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, [readOnly]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full min-h-[300px] overflow-hidden rounded-lg border-0 bg-[#080b10] p-2", className)}
    />
  );
}

export function writeToTerminal(terminal: Terminal | null, data: string) {
  if (!terminal) return;
  const normalized = data.replace(/\r?\n/g, "\r\n");
  terminal.write(normalized);
}

export function writelnToTerminal(terminal: Terminal | null, data: string) {
  if (!terminal) return;
  terminal.writeln(data);
}

/** Write one complete log line (strips trailing newlines, always ends the row). */
export function appendTerminalLine(terminal: Terminal | null, data: string) {
  if (!terminal) return;
  const line = data.replace(/\r?\n+$/, "");
  terminal.writeln(line);
}
