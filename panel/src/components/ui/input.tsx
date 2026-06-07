import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-lg border border-cyan-500/10 bg-cyan-500/[0.03] px-3 py-1 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus-visible:border-cyan-500/40 focus-visible:bg-cyan-500/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/20",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-xs font-medium uppercase tracking-wide text-zinc-500", className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-cyan-500/10 bg-cyan-500/[0.03] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus-visible:border-cyan-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/20",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-9 w-full appearance-none rounded-lg border border-cyan-500/10 bg-[#0a0d14] px-3 text-sm text-slate-200 focus-visible:border-cyan-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
