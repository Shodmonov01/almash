import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { calcTrustLevel, notify, writeAudit } from "@/lib/utils";
import { REVIEW_TAGS } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.enum(REVIEW_TAGS as unknown as [string, ...string[]])).optional(),
  text: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const trade = await prisma.trade.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
      include: { parties: true, reviews: true },
    });
    if (!trade) return jsonError("Не найдено", 404);
    if (trade.status !== "COMPLETED") {
      return jsonError("Отзыв только после завершённой сделки", 400);
    }
    if (trade.initiatorId !== user.id && trade.recipientId !== user.id) {
      return jsonError("Нет доступа", 403);
    }
    if (trade.reviews.some((r) => r.authorId === user.id)) {
      return jsonError("Вы уже оставили отзыв по этой сделке", 400);
    }

    // Anti-farming: limit repeated completed trades between same pair boosting
    const pairCount = await prisma.trade.count({
      where: {
        status: "COMPLETED",
        OR: [
          { initiatorId: trade.initiatorId, recipientId: trade.recipientId },
          { initiatorId: trade.recipientId, recipientId: trade.initiatorId },
        ],
      },
    });
    if (pairCount > 3) {
      return jsonError("Слишком много повторных обменов между теми же пользователями", 400);
    }

    const body = schema.parse(await req.json());
    const targetId =
      user.id === trade.initiatorId ? trade.recipientId : trade.initiatorId;

    const review = await prisma.review.create({
      data: {
        tradeId: trade.id,
        authorId: user.id,
        targetId,
        rating: body.rating,
        tags: JSON.stringify(body.tags ?? []),
        text: body.text,
      },
    });

    const agg = await prisma.review.aggregate({
      where: { targetId },
      _avg: { rating: true },
      _count: true,
    });

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    const rating = agg._avg.rating ?? 0;
    await prisma.user.update({
      where: { id: targetId },
      data: {
        rating,
        ratingCount: agg._count,
        trustLevel: calcTrustLevel(
          target?.completedTrades ?? 0,
          rating,
          target?.disputesCount ?? 0,
        ),
      },
    });

    await writeAudit({
      userId: user.id,
      tradeId: trade.id,
      action: "REVIEW_CREATED",
      meta: { rating: body.rating },
    });
    await notify({
      userId: targetId,
      tradeId: trade.id,
      type: "REVIEW",
      title: "Новый отзыв",
      body: `${user.name} оценил обмен на ${body.rating}`,
    });

    return jsonOk({ review });
  } catch (e) {
    return handleApiError(e);
  }
}
