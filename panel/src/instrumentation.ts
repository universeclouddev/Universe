export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { startScheduleRunner } = await import("@/lib/panel/schedules");
  startScheduleRunner();

  const { startBackgroundAlertEvaluator } = await import("@/lib/panel/alerts");
  startBackgroundAlertEvaluator();
}
