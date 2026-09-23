import type { AppRequest } from "@/lib/http";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { createOffer, TradeError } from "@/lib/services/trades";
import { RateLimitError } from "@/lib/services/rate-limit";

const offerSchema = z.object({
  targetItemIds: z.array(z.string()).min(1),
  offeredItemIds: z.array(z.string()).min(1),
  message: z.string().max(1000).optional(),
});

export async function GET(req: AppRequest) {
  try {
    const user = await requireUser();
    const status = new URL(req.url).searchParams.get("status");

    const trades = await prisma.trade.findMany({
      where: {
        OR: [{ initiatorId: user.id }, { recipientId: user.id }],
        ...(status ? { status } : {}),
      },
      include: {
        parties: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                trustLevel: true,
                rating: true,
              },
            },
          },
        },
        items: {
          include: {
            item: {
              include: { media: { orderBy: { sortOrder: "asc" }, take: 1 } },
            },
          },
        },
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            body: true,
            createdAt: true,
            system: true,
            flagged: true,
            senderId: true,
            mediaUrl: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const filtered = trades.map(({ messages, ...t }) => {
      const last = messages[0];
      return {
        ...t,
        items: t.items.filter((i) => i.version === t.currentVersion),
        lastMessage: last
          ? {
              ...last,
              body: last.flagged
                ? "[сообщение скрыто фильтром безопасности]"
                : last.body,
            }
          : null,
      };
    });

    return jsonOk({ trades: filtered });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: AppRequest) {
  try {
    const user = await requireUser();
    const body = offerSchema.parse(await req.json());
    const trade = await createOffer({
      userId: user.id,
      targetItemIds: body.targetItemIds,
      offeredItemIds: body.offeredItemIds,
      message: body.message,
    });
    return jsonOk(
      { trade: { id: trade.id, publicId: trade.publicId } },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof TradeError || e instanceof RateLimitError) {
      return jsonError(e.message, e.status);
    }
    return handleApiError(e);
  }
}
