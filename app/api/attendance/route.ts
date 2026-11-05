import { respond, readJson } from "@/app/lib/server/http";
import { ServiceError, setAttendance } from "@/app/lib/server/service";

/** PUT { workerId, date, patch: { status?, overtimeHours?, units? } } */
export async function PUT(req: Request) {
  return respond(async () => {
    const b = await readJson(req);
    if (typeof b.workerId !== "string" || typeof b.date !== "string" || !b.patch || typeof b.patch !== "object") {
      throw new ServiceError("workerId, date and patch are required");
    }
    setAttendance(b.workerId, b.date, b.patch as Record<string, unknown>);
  });
}
