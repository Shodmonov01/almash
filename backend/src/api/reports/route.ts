import type { AppRequest } from "@/lib/http";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { writeAudit } from "@/lib/utils";
import { REPORT_REASONS } from "@/lib/constants";

const schema = z.object({
  reason: z.enum(REPORT_REASONS as unknown as [string, ...string[]]),
  description: z.string().max(2000).optional(),
  targetUserId: z.string().optional(),
  itemId: z.string().optional(),
  tradeId: z.string().optional(),
});

export async function POST(req: AppRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());

    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        targetUserId: body.targetUserId,
        itemId: body.itemId,
        tradeId: body.tradeId,
        reason: body.reason,
        description: body.description,
      },
    });

    await prisma.riskEvent.create({
      data: {
        userId: body.targetUserId,
        tradeId: body.tradeId,
        type: "USER_REPORT",
        score: 15,
        detail: body.reason,
      },
    });

    await writeAudit({
      userId: user.id,
      tradeId: body.tradeId,
      action: "REPORT_CREATED",
      meta: { reason: body.reason, reportId: report.id },
    });

    return jsonOk({ report });
  } catch (e) {
    return handleApiError(e);
  }
}
