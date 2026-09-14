import { NextRequest } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { runMaintenanceJobs } from "@/lib/jobs/maintenance";
import { writeAudit } from "@/lib/utils";

/**
 * Cron-friendly endpoint. In production protect with CRON_SECRET.
 * Admins can always trigger; others need ?secret=
 */
export async function POST(req: NextRequest) {
  try {
    const secret = new URL(req.url).searchParams.get("secret");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && secret === cronSecret) {
      const result = await runMaintenanceJobs();
      return jsonOk({ ok: true, result, via: "cron" });
    }

    const user = await requireUser();
    if (user.role !== "ADMIN") {
      await requireAdmin();
    }

    const result = await runMaintenanceJobs();
    await writeAudit({
      userId: user.id,
      action: "JOBS_RUN",
      meta: result,
    });
    return jsonOk({ ok: true, result, via: "admin" });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
