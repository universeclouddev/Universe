"use client";



import { useRef, useCallback } from "react";

import { motion } from "framer-motion";

import { Terminal as TerminalIcon, Wifi, WifiOff } from "lucide-react";

import { PageHeader } from "@/components/layout/sidebar";

import { PermissionGuard } from "@/components/layout/auth-guard";

import { Card, CardContent } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { TerminalPane, writelnToTerminal } from "@/components/terminal/terminal-pane";

import { useUniverseWsAuth } from "@/hooks/use-universe-ws-auth";

import { usePing, useNodeInfo } from "@/lib/api/queries";

import type { Terminal } from "@xterm/xterm";



function useConsoleInput(send: (line: string) => void) {

  const terminalRef = useRef<Terminal | null>(null);

  const lineBufferRef = useRef("");



  const onReady = useCallback((terminal: Terminal) => {

    terminalRef.current = terminal;

    lineBufferRef.current = "";

    terminal.clear();

    writelnToTerminal(terminal, "Universe master console. Type `help` for available commands and press Enter.");

    terminal.write("> ");

  }, []);



  const onData = useCallback(

    (data: string) => {

      const terminal = terminalRef.current;

      if (!terminal) return;



      const code = data.charCodeAt(0);



      if (data === "\r") {

        terminal.write("\r\n");

        const line = lineBufferRef.current.trim();

        lineBufferRef.current = "";

        if (line) {

          send(line);

        }

        terminal.write("> ");

        return;

      }



      if (data === "\u007f" || data === "\b") {

        if (lineBufferRef.current.length > 0) {

          lineBufferRef.current = lineBufferRef.current.slice(0, -1);

          terminal.write("\b \b");

        }

        return;

      }



      if (code === 3) {

        terminal.write("^C\r\n> ");

        lineBufferRef.current = "";

        return;

      }



      if (code < 32 && data !== "\t") {

        return;

      }



      lineBufferRef.current += data;

      terminal.write(data);

    },

    [send],

  );



  return { terminalRef, onReady, onData };

}



export default function ConsolePage() {

  const ping = usePing();

  const nodeInfo = useNodeInfo();

  const terminalRef = useRef<Terminal | null>(null);

  const sendRef = useRef<(line: string) => void>(() => {});



  const onMessage = useCallback((data: string) => {

    const terminal = terminalRef.current;

    if (!terminal) return;

    writelnToTerminal(terminal, data);

  }, []);



  const ws = useUniverseWsAuth({

    purpose: "console",

    path: "/api/console",

    enabled: ping.data?.master === true,

    onMessage,

    onOpen: () => writelnToTerminal(terminalRef.current, "[connected]"),

  });



  sendRef.current = ws.send;



  const { onReady, onData } = useConsoleInput((line) => sendRef.current(line));



  const handleReady = useCallback(

    (terminal: Terminal) => {

      terminalRef.current = terminal;

      onReady(terminal);

    },

    [onReady],

  );



  return (

    <PermissionGuard permission="console.use">

      <div className="flex h-[calc(100vh-var(--header-height)-var(--status-bar-height)-2.5rem)] flex-col">

        <PageHeader

          title="Master Console"

          description="Interactive WebSocket console on the master node"

          meta={

            <Badge

              variant={ws.connected ? "success" : "default"}

              className="font-mono text-[10px] normal-case tracking-normal"

            >

              {ws.connected ? (

                <Wifi className="h-3 w-3" />

              ) : (

                <WifiOff className="h-3 w-3" />

              )}

              {ws.connected ? "ws_connected" : "ws_idle"}

            </Badge>

          }

        />



        {ping.data && !ping.data.master && (

          <Card className="mb-4 border-amber-500/20 bg-amber-500/[0.06]">

            <CardContent className="py-3 font-mono text-sm text-amber-200/90">

              Console WebSocket is only available on the master node. This node is a wrapper.

            </CardContent>

          </Card>

        )}



        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg ops-data-panel px-3 py-2 font-mono text-[11px]">

          <span className="flex items-center gap-1.5 text-slate-500">

            <TerminalIcon className="h-3.5 w-3.5 text-cyan-500/70" />

            endpoint:

            <span className="text-cyan-400/80">/api/console</span>

          </span>

          <span className="text-slate-700">|</span>

          <span className="text-slate-500">

            node: <span className="text-slate-400">{ping.data?.nodeId?.slice(0, 8) ?? "—"}</span>

          </span>

          <span className="text-slate-700">|</span>

          <span className="text-slate-500">

            role: <span className="text-slate-400">{ping.data?.master ? "MASTER" : "WRAPPER"}</span>

          </span>

          {nodeInfo.data && (

            <>

              <span className="text-slate-700">|</span>

              <span className="text-slate-500">

                api: <span className="text-slate-400">:{nodeInfo.data.apiPort}</span>

              </span>

            </>

          )}

          {(ws.error || ws.credError) && (

            <motion.span

              className="ml-auto text-red-400"

              initial={{ opacity: 0 }}

              animate={{ opacity: 1 }}

            >

              {ws.error ?? ws.credError}

            </motion.span>

          )}

        </div>



        <div className="min-h-0 flex-1 overflow-hidden rounded-xl terminal-chrome">

          <div className="flex items-center gap-2 border-b border-cyan-500/10 px-3 py-1.5">

            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />

            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />

            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />

            <span className="ml-2 font-mono text-[10px] text-slate-600">universe — master console</span>

            <span

              className={`ml-auto h-1.5 w-1.5 rounded-full ${ws.connected ? "bg-emerald-400 pulse-dot" : "bg-slate-600"}`}

            />

          </div>

          <div className="h-[calc(100%-2rem)] p-1">

            <TerminalPane onReady={handleReady} onData={onData} className="border-0 bg-transparent" />

          </div>

        </div>

      </div>

    </PermissionGuard>

  );

}


