"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Server, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AmbientBackground } from "@/components/layout/ambient-background";

type UniverseStatus = {
  found: boolean;
  clusterName: string | null;
  apiUrl: string | null;
};

function SetupForm() {
  const router = useRouter();
  const [name, setName] = useState("Admin");
  const [universe, setUniverse] = useState<UniverseStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const checkUniverse = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      setUniverse(data.universe ?? { found: false, clusterName: null, apiUrl: null });
    } catch {
      setUniverse({ found: false, clusterName: null, apiUrl: null });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkUniverse();
  }, [checkUniverse]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/panel/auto-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Setup failed");

      if (body.temporaryPassword) {
        setTempPassword(body.temporaryPassword);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof TypeError && err.message === "Failed to fetch"
          ? "Cannot reach the panel server — make sure npm run dev is running"
          : err instanceof Error
            ? err.message
            : "Setup failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (tempPassword) {
    return (
      <motion.div
        className="glass-panel glow-border w-full max-w-lg rounded-2xl p-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-4 flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="h-6 w-6" />
          <span className="text-lg font-bold text-zinc-100">You&apos;re all set!</span>
        </div>
        <p className="text-sm text-zinc-500">
          Save this password if you want to sign in from another browser. You can change it anytime
          in Settings → Users.
        </p>
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/30 p-4 font-mono text-sm text-violet-300">
          {tempPassword}
        </div>
        <p className="mt-3 text-xs text-zinc-600">Email: admin@local</p>
        <Button className="mt-6 w-full" onClick={() => router.push("/dashboard")}>
          Open dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="glass-panel glow-border w-full max-w-lg rounded-2xl p-8"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-violet-400" />
        <span className="text-lg font-bold">universe.</span>
        <Badge variant="accent" className="text-[9px]">
          SETUP
        </Badge>
      </div>

      <h2 className="text-xl font-bold text-zinc-100">Almost ready</h2>
      <p className="mt-1 text-sm text-zinc-500">
        No database or API keys to configure — just start Universe, then click below.
      </p>

      <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        {checking ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking for Universe on your machine...
          </div>
        ) : universe?.found ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="font-medium text-zinc-200">
                Found {universe.clusterName ?? "Universe cluster"}
              </p>
              <p className="mt-0.5 font-mono text-xs text-zinc-500">{universe.apiUrl}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <Server className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium text-zinc-200">Universe not running yet</p>
              <p className="mt-1 text-sm text-zinc-500">
                Start the Universe jar first, then{" "}
                <button
                  type="button"
                  onClick={checkUniverse}
                  className="text-violet-400 underline-offset-2 hover:underline"
                >
                  check again
                </button>
                .
              </p>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleStart} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Your display name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Admin"
            required
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading || checking || !universe?.found}>
          {loading ? "Setting up..." : "Get started"}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>
    </motion.div>
  );
}

export default function SetupPage() {
  return (
    <div className="app-mesh relative flex min-h-screen items-center justify-center p-6">
      <AmbientBackground />
      <Suspense fallback={<div className="text-zinc-500">Loading...</div>}>
        <SetupForm />
      </Suspense>
    </div>
  );
}
