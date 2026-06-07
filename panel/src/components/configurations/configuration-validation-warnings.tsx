"use client";

import { AlertTriangle, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  configValidationSummary,
  type ConfigValidationResult,
} from "@/lib/panel/config-validator";
import { cn } from "@/lib/utils";

interface ConfigurationValidationWarningsProps {
  result: ConfigValidationResult;
  className?: string;
}

export function ConfigurationValidationWarnings({
  result,
  className,
}: ConfigurationValidationWarningsProps) {
  if (result.issues.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300",
          className,
        )}
      >
        Configuration looks valid — no lint issues detected.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-medium text-amber-200">Configuration lint</span>
        <Badge variant="warning" className="font-mono text-[10px] normal-case">
          {configValidationSummary(result)}
        </Badge>
      </div>

      <ul className="space-y-1.5 text-sm">
        {result.issues.map((issue) => (
          <li
            key={`${issue.field}-${issue.message}`}
            className={cn(
              "flex items-start gap-2 rounded-md px-2 py-1.5",
              issue.severity === "error"
                ? "bg-red-500/10 text-red-300"
                : "bg-amber-500/10 text-amber-300",
            )}
          >
            {issue.severity === "error" ? (
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            )}
            <span>
              <span className="font-mono text-[11px] uppercase tracking-wide opacity-80">
                {issue.field}
              </span>
              {" — "}
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
