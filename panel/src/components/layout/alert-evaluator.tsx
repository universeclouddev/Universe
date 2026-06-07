"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/context";

export function AlertEvaluator() {
  const { hasPermission } = useAuth();

  useEffect(() => {
    if (!hasPermission("settings.universe")) return;

    let cancelled = false;

    async function poll() {
      try {
        await fetch("/api/panel/alerts/evaluate", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // background poll — ignore
      }
    }

    void poll();
    const timer = setInterval(() => {
      if (!cancelled) void poll();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hasPermission]);

  return null;
}
