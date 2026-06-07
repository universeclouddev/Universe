"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/context";
import { PanelErrorBoundary } from "@/components/layout/panel-error-boundary";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 3000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PanelErrorBoundary>
        <AuthProvider>
          {children}
          <Toaster theme="dark" richColors position="top-right" />
        </AuthProvider>
      </PanelErrorBoundary>
    </QueryClientProvider>
  );
}
