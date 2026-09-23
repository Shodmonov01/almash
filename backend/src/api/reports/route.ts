import type { AppRequest } from "@/lib/http";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { writeAudit } from "@/lib/utils";
import { assertRateLimit, RateLimitError } from "@/lib/services/rate-limit";
import { refreshUserRisk } from "@/lib/services/risk";
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
    await assertRateLimit(user.id, "report");
    const body = schema.parse(await req.json());

    // Resolve who is being reported: explicit user, the item owner, or the
    // other party of the trade.
    let targetUserId = body.targetUserId;
    if (!targetUserId && body.itemId) {
      const item = await prisma.item.findUnique({ where: { id: body.itemId } });
      targetUserId = item?.ownerId;
    }
    if (!targetUserId && body.tradeId) {
      const trade = await prisma.trade.findFirst({
        where: { OR: [{ id: body.tradeId }, { publicId: body.tradeId }] },
      });
      if (trade && (trade.initiatorId === user.id || trade.recipientId === user.id)) {
        targetUserId =
          trade.initiatorId === user.id ? trade.recipientId : trade.initiatorId;
      }
    }
    if (!targetUserId && !body.itemId) {
      return jsonError("Не указано, на кого жалоба", 400);
    }
    if (targetUserId === user.id) {
      return jsonError("Нельзя пожаловаться на себя", 400);
    }

    // One open report per reporter/target/reason — no report flooding
    const duplicate = await prisma.report.findFirst({
      where: {
        reporterId: user.id,
        targetUserId: targetUserId ?? null,
        itemId: body.itemId ?? null,
        reason: body.reason,
        status: "OPEN",
      },
    });
    if (duplicate) {
      return jsonError("Вы уже отправили такую жалобу — она на рассмотрении", 400);
    }

    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        targetUserId,
        itemId: body.itemId,
        tradeId: body.tradeId,
        reason: body.reason,
        description: body.description,
      },
    });

    await prisma.riskEvent.create({
      data: {
        userId: targetUserId,
        tradeId: body.tradeId,
        type: "USER_REPORT",
        score: 15,
        detail: body.reason,
      },
    });
    if (targetUserId) await refreshUserRisk(targetUserId);

    await writeAudit({
      userId: user.id,
      tradeId: body.tradeId,
      action: "REPORT_CREATED",
      meta: { reason: body.reason, reportId: report.id },
    });

    return jsonOk({ report });
  } catch (e) {
    if (e instanceof RateLimitError) return jsonError(e.message, 429);
    return handleApiError(e);
  }
}
