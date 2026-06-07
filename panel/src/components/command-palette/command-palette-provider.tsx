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
import { CommandPalette } from "@/components/command-palette/command-palette";
import { TemplateImportDialog } from "@/components/templates/template-import-dialog";

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  openTemplateImport: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [templateImportOpen, setTemplateImportOpen] = useState(false);

  const toggle = useCallback(() => setOpen((value) => !value), []);

  const openTemplateImport = useCallback(() => {
    setOpen(false);
    setTemplateImportOpen(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, toggle, openTemplateImport }),
    [open, toggle, openTemplateImport],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette />
      <TemplateImportDialog
        open={templateImportOpen}
        onClose={() => setTemplateImportOpen(false)}
      />
    </CommandPaletteContext.Provider>
  );
}
