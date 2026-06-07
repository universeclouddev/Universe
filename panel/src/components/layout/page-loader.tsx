export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-400">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-400"
        aria-hidden
      />
      <p className="text-sm">{label}</p>
    </div>
  );
}
