"use client";

import * as React from "react";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const AlertDialogContext = React.createContext<{ onOpenChange: (open: boolean) => void } | null>(
  null,
);

const AlertDialogIdsContext = React.createContext<{ titleId: string; descriptionId: string } | null>(
  null,
);

function useAlertDialogContext() {
  const ctx = React.useContext(AlertDialogContext);
  if (!ctx) throw new Error("AlertDialog components must be used within AlertDialog");
  return ctx;
}

function useAlertDialogIds() {
  const ctx = React.useContext(AlertDialogIdsContext);
  if (!ctx) throw new Error("AlertDialogHeader must be used within AlertDialogContent");
  return ctx;
}

export function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  if (!open) return null;
  return (
    <AlertDialogContext.Provider value={{ onOpenChange }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <AlertDialogOverlay onClick={() => onOpenChange(false)} />
        {children}
      </div>
    </AlertDialogContext.Provider>
  );
}

interface AlertDialogOverlayProps {
  onClick?: () => void;
  className?: string;
}

export function AlertDialogOverlay({ onClick, className }: AlertDialogOverlayProps) {
  return (
    <div
      className={cn("absolute inset-0 bg-black/60 backdrop-blur-sm", className)}
      aria-hidden
      onClick={onClick}
    />
  );
}

interface AlertDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  onEscapeClose?: boolean;
  preventClose?: boolean;
}

export function AlertDialogContent({
  className,
  children,
  onEscapeClose = true,
  preventClose = false,
  ...props
}: AlertDialogContentProps) {
  const { onOpenChange } = useAlertDialogContext();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && onEscapeClose && !preventClose) {
        onOpenChange(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onEscapeClose, onOpenChange, preventClose]);

  return (
    <div
      ref={panelRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      className={cn(
        "glass-panel glow-border relative z-10 w-full max-w-md rounded-xl p-6",
        "animate-in fade-in zoom-in-95 duration-200",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      <AlertDialogIdsContext.Provider value={{ titleId, descriptionId }}>
        {children}
      </AlertDialogIdsContext.Provider>
    </div>
  );
}

export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-2", className)} {...props} />;
}

export function AlertDialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useAlertDialogIds();
  return (
    <h2 id={titleId} className={cn("text-lg font-semibold text-zinc-100", className)} {...props} />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useAlertDialogIds();
  return (
    <p id={descriptionId} className={cn("text-sm text-zinc-500", className)} {...props} />
  );
}

export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />;
}

interface AlertDialogCancelProps extends React.ComponentProps<typeof Button> {
  onClick?: () => void;
}

export function AlertDialogCancel({ onClick, ...props }: AlertDialogCancelProps) {
  const { onOpenChange } = useAlertDialogContext();
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        onClick?.();
        onOpenChange(false);
      }}
      {...props}
    />
  );
}

interface AlertDialogActionProps extends React.ComponentProps<typeof Button> {}

export function AlertDialogAction({ className, ...props }: AlertDialogActionProps) {
  return <Button type="button" className={className} {...props} />;
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  icon?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  icon,
}: ConfirmDialogProps) {
  async function handleConfirm() {
    await onConfirm();
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <AlertDialogContent preventClose={loading}>
        <AlertDialogHeader>
          {icon ? (
            <div className="mb-3 flex items-center gap-2">
              {icon}
              <AlertDialogTitle className="mb-0">{title}</AlertDialogTitle>
            </div>
          ) : (
            <AlertDialogTitle>{title}</AlertDialogTitle>
          )}
          {description && <AlertDialogDescription className="mt-2">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant={variant} disabled={loading} onClick={handleConfirm}>
            {loading ? "Deleting..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
