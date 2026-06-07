"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const WIZARD_STEPS = [
  { id: "connect", label: "Connect", hint: "Link to your cluster" },
  { id: "template", label: "Template", hint: "Pick or import files" },
  { id: "config", label: "Config", hint: "Define how it runs" },
  { id: "deploy", label: "Deploy", hint: "Start the instance" },
  { id: "health", label: "Health", hint: "Wait until online" },
  { id: "console", label: "Console", hint: "Open and play" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

interface WizardStepperProps {
  currentIndex: number;
  completedThrough: number;
  onStepClick?: (index: number) => void;
}

export function WizardStepper({ currentIndex, completedThrough, onStepClick }: WizardStepperProps) {
  return (
    <nav aria-label="Wizard progress" className="mb-8">
      <ol className="flex flex-wrap items-start gap-2 sm:gap-0">
        {WIZARD_STEPS.map((step, index) => {
          const done = index < completedThrough;
          const active = index === currentIndex;
          const reachable = index <= completedThrough;
          const last = index === WIZARD_STEPS.length - 1;

          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-start">
              <button
                type="button"
                disabled={!reachable || !onStepClick}
                onClick={() => reachable && onStepClick?.(index)}
                className={cn(
                  "group flex min-w-0 flex-1 flex-col items-center gap-2 px-1 text-center transition-opacity",
                  reachable && onStepClick ? "cursor-pointer" : "cursor-default",
                  !reachable && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all",
                    done && "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
                    active && !done && "border-teal-400/50 bg-teal-400/10 text-teal-300 ring-2 ring-teal-400/20",
                    !done && !active && "border-white/[0.1] bg-white/[0.03] text-slate-500",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span className="hidden sm:block">
                  <span
                    className={cn(
                      "block text-[11px] font-semibold tracking-wide",
                      active ? "text-slate-100" : done ? "text-slate-300" : "text-slate-500",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-600">{step.hint}</span>
                </span>
              </button>
              {!last && (
                <div
                  className={cn(
                    "mx-1 mt-[18px] hidden h-px flex-1 sm:block",
                    index < completedThrough ? "bg-emerald-400/35" : "bg-white/[0.06]",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
