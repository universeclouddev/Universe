import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { InstanceState } from "@/lib/api/types";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/[0.06] text-zinc-300",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        danger: "border-red-500/30 bg-red-500/10 text-red-400",
        muted: "border-white/5 bg-white/[0.03] text-zinc-500",
        accent: "border-teal-400/25 bg-teal-400/10 text-teal-300",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-400 ring-1 ring-white/[0.08]">
      {count}
    </span>
  );
}

export function instanceStateVariant(state: InstanceState) {
  switch (state) {
    case "ONLINE":
      return "success" as const;
    case "CREATING":
      return "warning" as const;
    case "OFFLINE":
      return "warning" as const;
    case "STOPPED":
      return "muted" as const;
    default:
      return "default" as const;
  }
}

export function InstanceStateBadge({ state }: { state: InstanceState }) {
  const variant = instanceStateVariant(state);
  return (
    <Badge variant={variant}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          variant === "success" && "bg-emerald-400 pulse-dot",
          variant === "warning" && "bg-amber-400",
          variant === "muted" && "bg-zinc-500",
          variant === "default" && "bg-zinc-400",
        )}
      />
      {state}
    </Badge>
  );
}
