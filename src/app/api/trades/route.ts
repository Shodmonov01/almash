import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  itemSnapshot,
  nextPublicTradeId,
  notify,
  randomCode,
  randomToken,
  writeAudit,
} from "@/lib/utils";
import { OFFER_TTL_HOURS } from "@/lib/constants";
import { computeRiskScore } from "@/lib/antifraud";

const offerSchema = z.object({
  targetItemIds: z.array(z.string()).min(1),
  offeredItemIds: z.array(z.string()).min(1),
  message: z.string().max(1000).optional(),
});

export async function GET(req: NextRequest) {
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
          where: undefined,
          include: {
            item: {
              include: { media: { orderBy: { sortOrder: "asc" }, take: 1 } },
            },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const filtered = trades.map((t) => ({
      ...t,
      items: t.items.filter((i) => i.version === t.currentVersion),
    }));

    return jsonOk({ trades: filtered });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = offerSchema.parse(await req.json());

    const offered = await prisma.item.findMany({
      where: { id: { in: body.offeredItemIds }, ownerId: user.id, status: "ACTIVE" },
      include: { media: true },
    });
    if (offered.length !== body.offeredItemIds.length) {
      return jsonError("Некоторые ваши предметы недоступны", 400);
    }

    const targets = await prisma.item.findMany({
      where: { id: { in: body.targetItemIds }, status: "ACTIVE" },
      include: { media: true, owner: true },
    });
    if (targets.length !== body.targetItemIds.length) {
      return jsonError("Целевые предметы недоступны", 400);
    }

    const ownerIds = [...new Set(targets.map((t) => t.ownerId))];
    if (ownerIds.length !== 1) {
      return jsonError("Все целевые предметы должны принадлежать одному пользователю", 400);
    }
    const recipientId = ownerIds[0];
    if (recipientId === user.id) {
      return jsonError("Нельзя предложить обмен самому себе", 400);
    }

    const count = await prisma.trade.count();
    const publicId = nextPublicTradeId(count + 1);
    const expiresAt = new Date(Date.now() + OFFER_TTL_HOURS * 60 * 60 * 1000);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    const riskScore = computeRiskScore({
      isNewAccount: (dbUser?.completedTrades ?? 0) === 0,
      manyListings: (await prisma.item.count({ where: { ownerId: user.id } })) > 20,
      manyCancels: (dbUser?.cancelledTrades ?? 0) > 5,
      manyDisputes: (dbUser?.disputesCount ?? 0) > 3,
    });

    const trade = await prisma.trade.create({
      data: {
        publicId,
        status: "OFFER_SENT",
        initiatorId: user.id,
        recipientId,
        expiresAt,
        riskScore,
        confirmCodeA: randomCode(),
        confirmCodeB: randomCode(),
        qrToken: randomToken(),
        parties: {
          create: [
            { userId: user.id, side: "A" },
            { userId: recipientId, side: "B" },
          ],
        },
        items: {
          create: [
            ...offered.map((it) => ({
              itemId: it.id,
              ownerId: it.ownerId,
              side: "A",
              version: 1,
              itemSnapshot: itemSnapshot(it),
            })),
            ...targets.map((it) => ({
              itemId: it.id,
              ownerId: it.ownerId,
              side: "B",
              version: 1,
              itemSnapshot: itemSnapshot(it),
            })),
          ],
        },
        versions: {
          create: {
            version: 1,
            createdById: user.id,
            note: "Первичное предложение",
            payloadJson: JSON.stringify({
              offeredItemIds: body.offeredItemIds,
              targetItemIds: body.targetItemIds,
            }),
          },
        },
        messages: body.message
          ? {
              create: {
                senderId: user.id,
                body: body.message,
              },
            }
          : undefined,
      },
    });

    await prisma.item.updateMany({
      where: { id: { in: [...body.offeredItemIds, ...body.targetItemIds] } },
      data: { status: "IN_TRADE" },
    });

    await prisma.message.create({
      data: {
        tradeId: trade.id,
        senderId: user.id,
        body: `Создано предложение обмена ${publicId}`,
        system: true,
      },
    });

    await writeAudit({
      userId: user.id,
      tradeId: trade.id,
      action: "OFFER_CREATED",
      meta: { publicId },
    });

    await notify({
      userId: recipientId,
      tradeId: trade.id,
      type: "NEW_OFFER",
      title: "Новое предложение обмена",
      body: `${user.name} предложил обмен ${publicId}`,
    });

    return jsonOk({ trade: { id: trade.id, publicId: trade.publicId } }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
