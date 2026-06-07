"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  roleHasPermission,
  ROUTE_PERMISSIONS,
  type PanelPermission,
  type PanelRole,
} from "@/lib/panel/permissions";
import {
  DEFAULT_CLUSTER_HEALTH,
  resolveClusterHealth,
  type ClusterHealthSettings,
} from "@/lib/panel/cluster-health";

export interface PanelUser {
  id: string;
  email: string;
  name: string;
  role: PanelRole;
}

export interface PanelClusterSummary {
  id: string;
  name: string;
  apiUrl: string;
}

interface AuthState {
  user: PanelUser | null;
  clusters: PanelClusterSummary[];
  activeClusterId: string | null;
  activeCluster: PanelClusterSummary | null;
  activeClusterHealth: ClusterHealthSettings;
  apiUrl: string | null;
  universeConfigured: boolean;
  oidcEnabled: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  hasPermission: (permission: PanelPermission) => boolean;
  canAccessRoute: (path: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  switchCluster: (clusterId: string) => Promise<void>;
  fetchUniverseCredentials: (purpose?: "console" | "logs") => Promise<{ apiUrl: string; token: string }>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchSession() {
  const res = await fetch("/api/auth/session", { credentials: "include" });
  if (!res.ok) return null;
  return res.json() as Promise<{
    authenticated: boolean;
    user: PanelUser;
    clusters: PanelClusterSummary[];
    activeClusterId: string | null;
    activeCluster: PanelClusterSummary | null;
    activeClusterHealth: ClusterHealthSettings | null;
    universe: { configured: boolean; apiUrl: string | null };
    oidc: { enabled: boolean };
  }>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<PanelUser | null>(null);
  const [clusters, setClusters] = useState<PanelClusterSummary[]>([]);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [activeCluster, setActiveCluster] = useState<PanelClusterSummary | null>(null);
  const [activeClusterHealth, setActiveClusterHealth] =
    useState<ClusterHealthSettings>(DEFAULT_CLUSTER_HEALTH);
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [universeConfigured, setUniverseConfigured] = useState(false);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const data = await fetchSession();
    if (data?.authenticated) {
      setUser(data.user);
      setClusters(data.clusters ?? []);
      setActiveClusterId(data.activeClusterId);
      setActiveCluster(data.activeCluster);
      setActiveClusterHealth(resolveClusterHealth(data.activeClusterHealth));
      setApiUrl(data.universe.apiUrl);
      setUniverseConfigured(data.universe.configured);
      setOidcEnabled(data.oidc.enabled);
    } else {
      setUser(null);
      setClusters([]);
      setActiveClusterId(null);
      setActiveCluster(null);
      setActiveClusterHealth(DEFAULT_CLUSTER_HEALTH);
      setApiUrl(null);
      setUniverseConfigured(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const status = await fetch("/api/auth/status").then((r) => r.json());
        if (status.needsSetup) {
          setIsLoading(false);
          if (window.location.pathname !== "/setup") {
            router.replace("/setup");
          }
          return;
        }
        await refreshSession();
      } catch (err) {
        console.error("Failed to load panel auth status:", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshSession, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Login failed");
      }
      await refreshSession();
      router.push("/dashboard");
    },
    [refreshSession, router],
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setClusters([]);
    setActiveClusterId(null);
    setActiveCluster(null);
    setActiveClusterHealth(DEFAULT_CLUSTER_HEALTH);
    setApiUrl(null);
    router.push("/login");
  }, [router]);

  const switchCluster = useCallback(
    async (clusterId: string) => {
      const res = await fetch("/api/panel/clusters/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: clusterId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to switch cluster");
      }
      await refreshSession();
      await queryClient.invalidateQueries();
    },
    [queryClient, refreshSession],
  );

  const hasPermission = useCallback(
    (permission: PanelPermission) => {
      if (!user) return false;
      return roleHasPermission(user.role, permission);
    },
    [user],
  );

  const canAccessRoute = useCallback(
    (path: string) => {
      const base = "/" + path.split("/").filter(Boolean)[0];
      const perm = ROUTE_PERMISSIONS[base];
      if (!perm) return true;
      return hasPermission(perm);
    },
    [hasPermission],
  );

  const fetchUniverseCredentials = useCallback(async (purpose?: "console" | "logs") => {
    const q = purpose ? `?for=${purpose}` : "";
    const res = await fetch(`/api/panel/universe/connection${q}`, { credentials: "include" });
    if (!res.ok) throw new Error("Universe connection unavailable");
    return res.json() as Promise<{ apiUrl: string; token: string }>;
  }, []);

  const value = useMemo(
    () => ({
      user,
      clusters,
      activeClusterId,
      activeCluster,
      activeClusterHealth,
      apiUrl,
      universeConfigured,
      oidcEnabled,
      isAuthenticated: !!user,
      isLoading,
      isAdmin: user?.role === "operator",
      hasPermission,
      canAccessRoute,
      login,
      logout,
      refreshSession,
      switchCluster,
      fetchUniverseCredentials,
    }),
    [
      user,
      clusters,
      activeClusterId,
      activeCluster,
      activeClusterHealth,
      apiUrl,
      universeConfigured,
      oidcEnabled,
      isLoading,
      hasPermission,
      canAccessRoute,
      login,
      logout,
      refreshSession,
      switchCluster,
      fetchUniverseCredentials,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
