"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Shield, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AmbientBackground } from "@/components/layout/ambient-background";

export default function LoginPage() {
  const { login, oidcEnabled } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "oidc_token_exchange"
      ? "OIDC sign-in failed. Check panel OIDC settings."
      : searchParams.get("error")
        ? "Sign-in failed."
        : null,
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function handleOidc() {
    window.location.href = "/api/auth/oidc/start";
  }

  return (
    <div className="app-mesh relative flex min-h-screen">
      <AmbientBackground />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
      </div>

      <div className="relative hidden w-1/2 flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold text-zinc-100">universe.</p>
            <Badge variant="accent" className="text-[9px]">
              PANEL
            </Badge>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-zinc-50">
            Orchestrate your
            <br />
            <span className="text-gradient">Minecraft cloud</span>
          </h1>
          <p className="mt-4 max-w-md text-zinc-500">
            Sign in with your panel account. Universe API access is managed server-side — one
            ALL-permission service key links the panel to your cluster.
          </p>
        </div>

        <div className="flex items-center gap-6 text-xs text-zinc-600">
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Panel RBAC
          </span>
          <span className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> OIDC optional
          </span>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center p-6">
        <motion.div
          className="glass-panel glow-border w-full max-w-md rounded-2xl p-8"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-violet-400" />
              <span className="text-lg font-bold">universe.</span>
            </div>
          </div>

          <h2 className="text-xl font-bold text-zinc-100">Sign in</h2>
          <p className="mt-1 text-sm text-zinc-500">Use your panel email and password</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          {oidcEnabled && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="text-xs text-zinc-600">or</span>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={handleOidc}>
                Continue with SSO
              </Button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
