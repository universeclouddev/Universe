"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/layout/sidebar";
import { PermissionGuard } from "@/components/layout/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth/context";
import { useClusterNode, useExecuteCommand } from "@/lib/api/queries";

function formatCommandOutput(output: string | string[] | undefined): string {
  if (!output) return "";
  return Array.isArray(output) ? output.join("\n") : output;
}

export default function ClusterNodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const node = useClusterNode(id);
  const executeCommand = useExecuteCommand();
  const { hasPermission } = useAuth();
  const [command, setCommand] = useState("");
  const [lastOutput, setLastOutput] = useState<string | null>(null);

  const isLocal = node.data?.local === true;
  const canRunCommands = isLocal && hasPermission("console.use");

  async function handleCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim() || !canRunCommands) return;

    try {
      const result = await executeCommand.mutateAsync(command.trim());
      const text = formatCommandOutput(result.output as string | string[]);
      setLastOutput(text || "(no output)");
      toast.success("Command executed");
      setCommand("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Command failed");
    }
  }

  return (
    <PermissionGuard permission="cluster.read">
      <div>
        <Link
          href="/cluster"
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to cluster
        </Link>

        {node.isLoading && <p className="text-zinc-500">Loading...</p>}
        {node.data && (
          <>
            <DashboardHeader title={node.data.name} description={`Node ${node.data.id}`} />

            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-zinc-500">Address</p>
                  <p className="font-mono">
                    {node.data.address}:{node.data.port}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-zinc-500">Resources</p>
                  <p>
                    {node.data.resources?.usedRamMB ?? 0} MB RAM ·{" "}
                    {node.data.resources?.usedCpu ?? 0} CPU
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-zinc-500">Local node</p>
                  <Badge variant={node.data.local ? "success" : "default"}>
                    {node.data.local ? "Yes" : "No"}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Hosted instances</CardTitle>
              </CardHeader>
              <CardContent>
                {node.data.instances.length === 0 ? (
                  <p className="text-sm text-zinc-500">No instances on this node</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {node.data.instances.map((instanceId) => (
                      <Link
                        key={instanceId}
                        href={`/instances/${instanceId}`}
                        className="rounded-md border border-zinc-700 px-3 py-1 font-mono text-sm text-sky-400 hover:bg-zinc-900"
                      >
                        {instanceId}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isLocal ? "Console command" : "Remote command"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLocal ? (
                  hasPermission("console.use") ? (
                  <>
                    <p className="mb-4 text-sm text-zinc-500">
                      Runs on this master node via the Universe command system. For interactive
                      input, use{" "}
                      <Link href="/console" className="text-violet-400 hover:underline">
                        Console
                      </Link>
                      .
                    </p>
                    <form onSubmit={handleCommand} className="flex gap-2">
                      <Input
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="instance list"
                        className="font-mono"
                      />
                      <Button type="submit" disabled={executeCommand.isPending}>
                        Execute
                      </Button>
                    </form>
                    {lastOutput !== null && (
                      <pre className="mt-4 max-h-64 overflow-auto rounded-xl border border-white/[0.06] bg-[#0a0c12] p-4 font-mono text-xs text-zinc-400 whitespace-pre-wrap">
                        {lastOutput}
                      </pre>
                    )}
                  </>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      You don&apos;t have permission to run console commands on this node.
                    </p>
                  )
                ) : (
                  <p className="text-sm text-zinc-500">
                    Remote node commands are not implemented yet. Commands can only be run on the
                    local master node — open the node marked <strong className="text-zinc-400">Local: Yes</strong>{" "}
                    or use{" "}
                    <Link href="/console" className="text-violet-400 hover:underline">
                      Console
                    </Link>{" "}
                    on the master.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PermissionGuard>
  );
}
