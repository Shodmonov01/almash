import type { AppRequest } from "@/lib/http";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { notify, writeAudit } from "@/lib/utils";
import { DISPUTE_REASONS } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  reason: z.enum(DISPUTE_REASONS as unknown as [string, ...string[]]),
  description: z.string().min(10).max(4000),
  evidence: z.array(z.string()).optional(),
});

export async function POST(req: AppRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const trade = await prisma.trade.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
    });
    if (!trade) return jsonError("Не найдено", 404);
    if (trade.initiatorId !== user.id && trade.recipientId !== user.id) {
      return jsonError("Нет доступа", 403);
    }
    if (["CANCELLED", "BLOCKED"].includes(trade.status)) {
      return jsonError("Спор недоступен", 400);
    }

    const body = schema.parse(await req.json());
    const dispute = await prisma.dispute.create({
      data: {
        tradeId: trade.id,
        openedById: user.id,
        reason: body.reason,
        description: body.description,
        evidenceJson: JSON.stringify(body.evidence ?? []),
        status: "OPEN",
      },
    });

    await prisma.trade.update({
      where: { id: trade.id },
      data: { status: "DISPUTED" },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { disputesCount: { increment: 1 } },
    });

    await prisma.message.create({
      data: {
        tradeId: trade.id,
        senderId: user.id,
        body: `Открыт спор: ${body.reason}`,
        system: true,
      },
    });

    await writeAudit({
      userId: user.id,
      tradeId: trade.id,
      action: "DISPUTE_OPENED",
      meta: { reason: body.reason },
    });

    const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
    for (const a of admins) {
      await notify({
        userId: a.id,
        tradeId: trade.id,
        type: "DISPUTE",
        title: "Новый спор",
        body: `${trade.publicId}: ${body.reason}`,
      });
    }

    return jsonOk({ dispute });
  } catch (e) {
    return handleApiError(e);
  }
}
