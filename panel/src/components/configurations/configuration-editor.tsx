"use client";

import dynamic from "next/dynamic";
import type { Configuration } from "@/lib/api/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface ConfigurationEditorProps {
  value: Configuration;
  onChange: (value: Configuration) => void;
}

export function ConfigurationEditor({ value, onChange }: ConfigurationEditorProps) {
  const json = JSON.stringify(value, null, 2);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <MonacoEditor
        height="500px"
        language="json"
        theme="vs-dark"
        value={json}
        onChange={(text) => {
          if (!text) return;
          try {
            onChange(JSON.parse(text) as Configuration);
          } catch {
            // ignore invalid JSON while typing
          }
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
