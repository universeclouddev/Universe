import { SchedulesWorkspace } from "@/components/schedules/schedules-workspace";
import { listClusters } from "@/lib/panel/clusters";

export default function SchedulesPage() {
  const clusters = listClusters().map((c) => ({ id: c.id, name: c.name }));
  return <SchedulesWorkspace clusters={clusters} />;
}
