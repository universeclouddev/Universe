import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50 max-md:min-h-11 max-md:px-4",
  {
    variants: {
      variant: {
        default:
          "btn-glow bg-gradient-to-b from-teal-400 to-teal-500 text-slate-950 hover:from-teal-300 hover:to-teal-400",
        secondary:
          "bg-white/[0.06] text-zinc-100 border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/[0.12]",
        destructive:
          "bg-gradient-to-b from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600",
        outline:
          "border border-white/[0.1] bg-transparent text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100 hover:border-white/[0.14]",
        ghost: "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
