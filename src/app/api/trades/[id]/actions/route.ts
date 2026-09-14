import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  calcTrustLevel,
  itemSnapshot,
  notify,
  writeAudit,
} from "@/lib/utils";
import { SAFE_MEETING_PLACES } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

async function loadTrade(id: string) {
  return prisma.trade.findFirst({
    where: { OR: [{ id }, { publicId: id }] },
    include: {
      parties: true,
      items: true,
    },
  });
}

function assertParty(
  trade: { initiatorId: string; recipientId: string },
  userId: string,
  role: string,
) {
  if (role === "ADMIN") return true;
  return trade.initiatorId === userId || trade.recipientId === userId;
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("reject"), reason: z.string().optional() }),
  z.object({
    action: z.literal("counter"),
    offeredItemIds: z.array(z.string()).min(1),
    targetItemIds: z.array(z.string()).min(1),
    note: z.string().optional(),
  }),
  z.object({
    action: z.literal("confirm_terms"),
    viewedItemsAck: z.literal(true),
  }),
  z.object({
    action: z.literal("schedule_meeting"),
    meetingAt: z.string(),
    meetingPlace: z.string().min(3),
    meetingNotes: z.string().optional(),
  }),
  z.object({ action: z.literal("start_handoff") }),
  z.object({
    action: z.literal("confirm_handoff"),
    code: z.string().optional(),
    qrToken: z.string().optional(),
  }),
  z.object({
    action: z.literal("cancel"),
    reason: z.string().min(3),
  }),
  z.object({
    action: z.literal("no_show"),
  }),
]);

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = actionSchema.parse(await req.json());
    const trade = await loadTrade(id);
    if (!trade) return jsonError("Сделка не найдена", 404);
    if (!assertParty(trade, user.id, user.role)) return jsonError("Нет доступа", 403);

    const myParty = trade.parties.find((p) => p.userId === user.id);
    if (!myParty && user.role !== "ADMIN") return jsonError("Нет доступа", 403);

    switch (body.action) {
      case "accept": {
        if (trade.recipientId !== user.id) return jsonError("Только получатель может принять", 403);
        if (!["OFFER_SENT", "NEGOTIATION"].includes(trade.status)) {
          return jsonError("Нельзя принять в текущем статусе", 400);
        }
        await prisma.trade.update({
          where: { id: trade.id },
          data: { status: "NEGOTIATION" },
        });
        await prisma.message.create({
          data: {
            tradeId: trade.id,
            senderId: user.id,
            body: "Предложение принято. Согласуйте финальный состав и условия.",
            system: true,
          },
        });
        await writeAudit({ userId: user.id, tradeId: trade.id, action: "OFFER_ACCEPTED" });
        await notify({
          userId: trade.initiatorId,
          tradeId: trade.id,
          type: "OFFER_ACCEPTED",
          title: "Предложение принято",
          body: `${user.name} принял предложение ${trade.publicId}`,
        });
        break;
      }

      case "reject": {
        if (trade.recipientId !== user.id) return jsonError("Только получатель может отклонить", 403);
        if (!["OFFER_SENT", "NEGOTIATION"].includes(trade.status)) {
          return jsonError("Нельзя отклонить в текущем статусе", 400);
        }
        await cancelTrade(trade.id, user.id, body.reason || "Отклонено получателем", "CANCELLED");
        break;
      }

      case "counter": {
        if (!["OFFER_SENT", "NEGOTIATION", "TERMS_AGREED"].includes(trade.status)) {
          return jsonError("Нельзя изменить состав", 400);
        }
        if (trade.status === "TERMS_AGREED" && trade.termsLockedAt) {
          // creating new version unlocks
        }

        const allIds = [...body.offeredItemIds, ...body.targetItemIds];
        const items = await prisma.item.findMany({
          where: { id: { in: allIds } },
          include: { media: true },
        });
        if (items.length !== allIds.length) return jsonError("Предметы недоступны", 400);

        const sideAOwner = trade.initiatorId;
        const sideBOwner = trade.recipientId;

        for (const iid of body.offeredItemIds) {
          const it = items.find((i) => i.id === iid)!;
          if (it.ownerId !== sideAOwner) return jsonError("Сторона A: неверные предметы", 400);
        }
        for (const iid of body.targetItemIds) {
          const it = items.find((i) => i.id === iid)!;
          if (it.ownerId !== sideBOwner) return jsonError("Сторона B: неверные предметы", 400);
        }

        const newVersion = trade.currentVersion + 1;

        // release old items not in new set
        const oldItems = trade.items.filter((i) => i.version === trade.currentVersion);
        const oldIds = oldItems.map((i) => i.itemId);
        const release = oldIds.filter((oid) => !allIds.includes(oid));
        if (release.length) {
          await prisma.item.updateMany({
            where: { id: { in: release }, status: "IN_TRADE" },
            data: { status: "ACTIVE" },
          });
        }
        await prisma.item.updateMany({
          where: { id: { in: allIds } },
          data: { status: "IN_TRADE" },
        });

        await prisma.tradeItem.createMany({
          data: [
            ...body.offeredItemIds.map((itemId) => {
              const it = items.find((i) => i.id === itemId)!;
              return {
                tradeId: trade.id,
                itemId,
                ownerId: it.ownerId,
                side: "A",
                version: newVersion,
                itemSnapshot: itemSnapshot(it),
              };
            }),
            ...body.targetItemIds.map((itemId) => {
              const it = items.find((i) => i.id === itemId)!;
              return {
                tradeId: trade.id,
                itemId,
                ownerId: it.ownerId,
                side: "B",
                version: newVersion,
                itemSnapshot: itemSnapshot(it),
              };
            }),
          ],
        });

        await prisma.tradeVersion.create({
          data: {
            tradeId: trade.id,
            version: newVersion,
            createdById: user.id,
            note: body.note || "Изменение состава",
            payloadJson: JSON.stringify({
              offeredItemIds: body.offeredItemIds,
              targetItemIds: body.targetItemIds,
            }),
          },
        });

        await prisma.tradeParty.updateMany({
          where: { tradeId: trade.id },
          data: { confirmedTerms: false, viewedItemsAck: false },
        });

        await prisma.trade.update({
          where: { id: trade.id },
          data: {
            currentVersion: newVersion,
            status: "NEGOTIATION",
            termsLockedAt: null,
          },
        });

        await prisma.message.create({
          data: {
            tradeId: trade.id,
            senderId: user.id,
            body: `Состав обмена изменён (версия ${newVersion}). Требуется повторное подтверждение условий.`,
            system: true,
          },
        });
        await writeAudit({
          userId: user.id,
          tradeId: trade.id,
          action: "TRADE_COMPOSITION_CHANGED",
          meta: { version: newVersion },
        });
        break;
      }

      case "confirm_terms": {
        if (!["NEGOTIATION", "OFFER_SENT", "TERMS_AGREED"].includes(trade.status)) {
          return jsonError("Нельзя подтвердить условия", 400);
        }
        await prisma.tradeParty.update({
          where: { id: myParty!.id },
          data: { confirmedTerms: true, viewedItemsAck: body.viewedItemsAck },
        });
        await writeAudit({
          userId: user.id,
          tradeId: trade.id,
          action: "TERMS_CONFIRMED_BY_PARTY",
          meta: { side: myParty!.side },
        });

        const parties = await prisma.tradeParty.findMany({ where: { tradeId: trade.id } });
        if (parties.every((p) => p.confirmedTerms)) {
          // freeze snapshots
          const currentItems = await prisma.tradeItem.findMany({
            where: { tradeId: trade.id, version: trade.currentVersion },
            include: { item: { include: { media: true } } },
          });
          for (const ti of currentItems) {
            await prisma.tradeItem.update({
              where: { id: ti.id },
              data: { itemSnapshot: itemSnapshot(ti.item) },
            });
            await prisma.item.update({
              where: { id: ti.itemId },
              data: { snapshotJson: itemSnapshot(ti.item) },
            });
          }

          await prisma.trade.update({
            where: { id: trade.id },
            data: { status: "TERMS_AGREED", termsLockedAt: new Date() },
          });
          await prisma.message.create({
            data: {
              tradeId: trade.id,
              senderId: user.id,
              body: "Условия сделки зафиксированы обеими сторонами. Состав заблокирован.",
              system: true,
            },
          });
          await writeAudit({
            userId: user.id,
            tradeId: trade.id,
            action: "TERMS_LOCKED",
          });
        }
        break;
      }

      case "schedule_meeting": {
        if (!["TERMS_AGREED", "MEETING_SCHEDULED"].includes(trade.status)) {
          return jsonError("Сначала зафиксируйте условия", 400);
        }
        const meetingAt = new Date(body.meetingAt);
        if (Number.isNaN(meetingAt.getTime()) || meetingAt.getTime() < Date.now()) {
          return jsonError("Некорректная дата встречи", 400);
        }

        await prisma.trade.update({
          where: { id: trade.id },
          data: {
            status: "MEETING_SCHEDULED",
            meetingAt,
            meetingPlace: body.meetingPlace,
            meetingNotes: body.meetingNotes,
          },
        });
        await prisma.message.create({
          data: {
            tradeId: trade.id,
            senderId: user.id,
            body: `Встреча: ${meetingAt.toLocaleString("ru-RU")} · ${body.meetingPlace}`,
            system: true,
          },
        });
        await writeAudit({
          userId: user.id,
          tradeId: trade.id,
          action: "MEETING_SCHEDULED",
          meta: { meetingAt, place: body.meetingPlace },
        });

        const otherId =
          user.id === trade.initiatorId ? trade.recipientId : trade.initiatorId;
        await notify({
          userId: otherId,
          tradeId: trade.id,
          type: "MEETING_SCHEDULED",
          title: "Встреча назначена",
          body: `${trade.publicId}: ${body.meetingPlace}`,
        });
        break;
      }

      case "start_handoff": {
        if (!["MEETING_SCHEDULED", "HANDOFF_PENDING"].includes(trade.status)) {
          return jsonError("Сначала назначьте встречу", 400);
        }
        await prisma.trade.update({
          where: { id: trade.id },
          data: { status: "HANDOFF_PENDING" },
        });
        await writeAudit({
          userId: user.id,
          tradeId: trade.id,
          action: "HANDOFF_STARTED",
        });
        break;
      }

      case "confirm_handoff": {
        if (
          ![
            "MEETING_SCHEDULED",
            "HANDOFF_PENDING",
            "PARTY_A_CONFIRMED",
            "PARTY_B_CONFIRMED",
          ].includes(trade.status)
        ) {
          return jsonError("Подтверждение недоступно", 400);
        }

        const side = myParty!.side;
        const expectedCode = side === "A" ? trade.confirmCodeB : trade.confirmCodeA;
        // User enters the OTHER party's code (received verbally / via QR of deal)
        const validCode = body.code && body.code === expectedCode;
        const validQr = body.qrToken && body.qrToken === trade.qrToken;
        if (!validCode && !validQr) {
          return jsonError("Неверный код или QR сделки", 400);
        }

        const now = new Date();
        const data: Record<string, unknown> = {};
        if (side === "A") {
          if (trade.partyAConfirmedAt) return jsonError("Вы уже подтвердили", 400);
          data.partyAConfirmedAt = now;
        } else {
          if (trade.partyBConfirmedAt) return jsonError("Вы уже подтвердили", 400);
          data.partyBConfirmedAt = now;
        }

        const otherConfirmed =
          side === "A" ? !!trade.partyBConfirmedAt : !!trade.partyAConfirmedAt;

        if (otherConfirmed) {
          data.status = "COMPLETED";
        } else {
          data.status = side === "A" ? "PARTY_A_CONFIRMED" : "PARTY_B_CONFIRMED";
          if (trade.status === "MEETING_SCHEDULED") {
            // keep pending semantics
          }
        }

        await prisma.trade.update({ where: { id: trade.id }, data });
        await writeAudit({
          userId: user.id,
          tradeId: trade.id,
          action: "HANDOFF_CONFIRMED",
          meta: { side },
        });
        await prisma.message.create({
          data: {
            tradeId: trade.id,
            senderId: user.id,
            body: `Участник ${side} подтвердил получение предметов.`,
            system: true,
          },
        });

        if (otherConfirmed) {
          await completeTrade(trade.id);
        }
        break;
      }

      case "cancel": {
        if (["COMPLETED", "CANCELLED", "BLOCKED"].includes(trade.status)) {
          return jsonError("Нельзя отменить", 400);
        }
        if (trade.partyAConfirmedAt || trade.partyBConfirmedAt) {
          if (!body.reason || body.reason.length < 5) {
            return jsonError("После частичного подтверждения нужна причина", 400);
          }
        }
        await cancelTrade(trade.id, user.id, body.reason, "CANCELLED");
        break;
      }

      case "no_show": {
        if (!["MEETING_SCHEDULED", "HANDOFF_PENDING"].includes(trade.status)) {
          return jsonError("Неявка доступна только после назначения встречи", 400);
        }
        await prisma.tradeParty.update({
          where: { id: myParty!.id },
          data: { noShowReported: true },
        });
        const other = trade.parties.find((p) => p.userId !== user.id);
        if (other) {
          await prisma.user.update({
            where: { id: other.userId },
            data: { noShowCount: { increment: 1 } },
          });
        }
        await writeAudit({
          userId: user.id,
          tradeId: trade.id,
          action: "NO_SHOW_REPORTED",
        });
        break;
      }
    }

    const updated = await loadTrade(trade.id);
    return jsonOk({
      trade: updated,
      safePlaces: SAFE_MEETING_PLACES,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

async function cancelTrade(
  tradeId: string,
  userId: string,
  reason: string,
  status: string,
) {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { items: true },
  });
  if (!trade) return;

  const currentIds = trade.items
    .filter((i) => i.version === trade.currentVersion)
    .map((i) => i.itemId);

  await prisma.trade.update({
    where: { id: tradeId },
    data: {
      status,
      cancelledById: userId,
      cancelReason: reason,
    },
  });

  if (currentIds.length) {
    await prisma.item.updateMany({
      where: { id: { in: currentIds }, status: "IN_TRADE" },
      data: { status: "ACTIVE" },
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { cancelledTrades: { increment: 1 } },
  });

  await prisma.message.create({
    data: {
      tradeId,
      senderId: userId,
      body: `Сделка отменена: ${reason}`,
      system: true,
    },
  });

  await writeAudit({
    userId,
    tradeId,
    action: "TRADE_CANCELLED",
    meta: { reason },
  });
}

async function completeTrade(tradeId: string) {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { items: true, parties: true },
  });
  if (!trade) return;

  const currentIds = trade.items
    .filter((i) => i.version === trade.currentVersion)
    .map((i) => i.itemId);

  await prisma.item.updateMany({
    where: { id: { in: currentIds } },
    data: { status: "TRADED" },
  });

  for (const p of trade.parties) {
    const u = await prisma.user.update({
      where: { id: p.userId },
      data: { completedTrades: { increment: 1 } },
    });
    const trustLevel = calcTrustLevel(u.completedTrades, u.rating, u.disputesCount);
    await prisma.user.update({
      where: { id: p.userId },
      data: { trustLevel },
    });
    await notify({
      userId: p.userId,
      tradeId,
      type: "TRADE_COMPLETED",
      title: "Обмен завершён",
      body: `${trade.publicId} успешно завершён. Оставьте отзыв.`,
    });
  }

  await prisma.message.create({
    data: {
      tradeId,
      senderId: trade.initiatorId,
      body: "Обмен подтверждён обеими сторонами. Сделка завершена.",
      system: true,
    },
  });

  await writeAudit({ tradeId, action: "TRADE_COMPLETED" });
}
