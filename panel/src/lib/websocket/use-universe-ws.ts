"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toWebSocketUrl } from "@/lib/websocket/url";

/** Close codes where the server rejected the connection — do not auto-reconnect. */
const NON_RECONNECT_CLOSE_CODES = new Set([1000, 1001, 1003, 1008, 1011]);

interface UseUniverseWsOptions {
  apiUrl: string;
  token: string | null;
  path: string;
  enabled?: boolean;
  reconnect?: boolean;
  onMessage?: (data: string) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
}

export function useUniverseWs({
  apiUrl,
  token,
  path,
  enabled = true,
  reconnect = true,
  onMessage,
  onOpen,
  onClose,
}: UseUniverseWsOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttempt = useRef(0);

  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  onMessageRef.current = onMessage;
  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled || !token) {
      setConnected(false);
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (cancelled) return;
      const url = toWebSocketUrl(apiUrl, path, token);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        reconnectAttempt.current = 0;
        setConnected(true);
        setError(null);
        onOpenRef.current?.();
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          onMessageRef.current?.(event.data);
        }
      };

      ws.onerror = () => {
        if (!cancelled) setError("WebSocket connection error");
      };

      ws.onclose = (event) => {
        if (cancelled) return;
        setConnected(false);
        onCloseRef.current?.(event);
        if (!reconnect || NON_RECONNECT_CLOSE_CODES.has(event.code)) {
          return;
        }
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
        reconnectAttempt.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [apiUrl, token, path, enabled]);

  return { connected, error, send, disconnect };
}
