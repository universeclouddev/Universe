"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Panel render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
          <div className="glass-panel max-w-lg rounded-2xl p-6 text-center">
            <h1 className="text-lg font-semibold text-zinc-100">Panel failed to load</h1>
            <p className="mt-2 text-sm text-zinc-500">
              {this.state.error.message || "An unexpected error occurred."}
            </p>
            <p className="mt-4 text-xs text-zinc-600">
              If you access the panel over Tailscale or LAN, restart with{" "}
              <code className="rounded bg-zinc-900 px-1 py-0.5">npm run dev</code> on the host
              machine and use <code className="rounded bg-zinc-900 px-1 py-0.5">http://hostname:3000</code>.
            </p>
            <button
              type="button"
              className="mt-6 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
