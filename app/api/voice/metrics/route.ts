import { connection, NextResponse } from "next/server";
import { metricsSummary, resetMetrics } from "@/app/lib/voice/metrics";

/** GET: aggregate quality metrics for the voice assistant (latency, clarification rate, outcomes). */
export async function GET(req: Request) {
  await connection();
  const dry = new URL(req.url).searchParams.get("dryRun");
  return NextResponse.json(metricsSummary({ includeDryRun: dry !== "exclude" }));
}

/** DELETE: clears the in-memory metrics (used by the eval runner for a clean baseline). */
export async function DELETE() {
  await connection();
  resetMetrics();
  return NextResponse.json({ ok: true });
}
