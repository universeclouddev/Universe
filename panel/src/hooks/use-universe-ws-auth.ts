"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { useUniverseWs } from "@/lib/websocket/use-universe-ws";

interface UseUniverseWsAuthOptions {
  purpose: "console" | "logs";
  path: string;
  enabled?: boolean;
  reconnect?: boolean;
  onMessage?: (data: string) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
}

export function useUniverseWsAuth(options: UseUniverseWsAuthOptions) {
  const { fetchUniverseCredentials } = useAuth();
  const [creds, setCreds] = useState<{ apiUrl: string; token: string } | null>(null);
  const [credError, setCredError] = useState<string | null>(null);

  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled) {
      setCreds(null);
      return;
    }

    let cancelled = false;
    fetchUniverseCredentials(options.purpose)
      .then((data) => {
        if (!cancelled) {
          setCreds(data);
          setCredError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCreds(null);
          setCredError(err instanceof Error ? err.message : "Connection unavailable");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, options.purpose, fetchUniverseCredentials]);

  const ws = useUniverseWs({
    apiUrl: creds?.apiUrl ?? "",
    token: creds?.token ?? null,
    path: options.path,
    enabled: enabled && !!creds,
    reconnect: options.reconnect,
    onMessage: options.onMessage,
    onOpen: options.onOpen,
    onClose: options.onClose,
  });

  return {
    ...ws,
    credError,
    credentialsReady: !!creds,
  };
}
