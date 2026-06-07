"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function InstanceLookup() {
  const router = useRouter();
  const [instanceId, setInstanceId] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = instanceId.trim();
    if (id.length === 6) {
      router.push(`/instances/${id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1 space-y-1">
        <Label htmlFor="instanceId">Instance ID</Label>
        <Input
          id="instanceId"
          value={instanceId}
          onChange={(e) => setInstanceId(e.target.value)}
          placeholder="a1b2c3"
          maxLength={6}
          className="font-mono"
        />
      </div>
      <Button type="submit" className="mt-6" disabled={instanceId.trim().length !== 6}>
        Open
      </Button>
    </form>
  );
}
