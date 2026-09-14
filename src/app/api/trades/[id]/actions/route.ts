import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { itemSnapshot, notify, writeAudit } from "@/lib/utils";
import { SAFE_MEETING_PLACES } from "@/lib/constants";
import {
  assertPartyAccess,
  cancelTrade,
  confirmHandoff,
  counterOffer,
  loadTradeOrThrow,
  TradeError,
} from "@/lib/services/trades";

type Ctx = { params: Promise<{ id: string }> };

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
  z.object({ action: z.literal("cancel"), reason: z.string().min(3) }),
  z.object({ action: z.literal("no_show") }),
]);

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = actionSchema.parse(await req.json());
    const trade = await loadTradeOrThrow(id);
    assertPartyAccess(trade, user.id, user.role);

    const myParty = trade.parties.find((p) => p.userId === user.id);
    if (!myParty && user.role !== "ADMIN") {
      return jsonError("Нет доступа", 403);
    }

    switch (body.action) {
      case "accept": {
        if (trade.recipientId !== user.id) {
          return jsonError("Только получатель может принять", 403);
        }
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
        await writeAudit({
          userId: user.id,
          tradeId: trade.id,
          action: "OFFER_ACCEPTED",
        });
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
        if (trade.recipientId !== user.id) {
          return jsonError("Только получатель может отклонить", 403);
        }
        if (!["OFFER_SENT", "NEGOTIATION"].includes(trade.status)) {
          return jsonError("Нельзя отклонить в текущем статусе", 400);
        }
        await cancelTrade({
          tradeId: trade.id,
          userId: user.id,
          reason: body.reason || "Отклонено получателем",
        });
        break;
      }

      case "counter": {
        await counterOffer({
          tradeId: trade.id,
          userId: user.id,
          offeredItemIds: body.offeredItemIds,
          targetItemIds: body.targetItemIds,
          note: body.note,
        });
        const other =
          user.id === trade.initiatorId ? trade.recipientId : trade.initiatorId;
        await notify({
          userId: other,
          tradeId: trade.id,
          type: "OFFER_CHANGED",
          title: "Состав обмена изменён",
          body: `${trade.publicId}: нужна новая фиксация условий`,
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

        const parties = await prisma.tradeParty.findMany({
          where: { tradeId: trade.id },
        });
        if (parties.every((p) => p.confirmedTerms)) {
          const currentItems = await prisma.tradeItem.findMany({
            where: { tradeId: trade.id, version: trade.currentVersion },
            include: { item: { include: { media: true } } },
          });
          for (const ti of currentItems) {
            const snap = itemSnapshot(ti.item);
            await prisma.tradeItem.update({
              where: { id: ti.id },
              data: { itemSnapshot: snap },
            });
            await prisma.item.update({
              where: { id: ti.itemId },
              data: { snapshotJson: snap },
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
              body: "Условия сделки зафиксированы обеими сторонами. Состав и фото заблокированы.",
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
            reminder24Sent: false,
            reminder2Sent: false,
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
        await confirmHandoff({
          tradeId: trade.id,
          userId: user.id,
          side: myParty!.side as "A" | "B",
          code: body.code,
          qrToken: body.qrToken,
        });
        break;
      }

      case "cancel": {
        if (["COMPLETED", "CANCELLED", "BLOCKED"].includes(trade.status)) {
          return jsonError("Нельзя отменить", 400);
        }
        if (
          (trade.partyAConfirmedAt || trade.partyBConfirmedAt) &&
          body.reason.length < 5
        ) {
          return jsonError("После частичного подтверждения нужна причина", 400);
        }
        await cancelTrade({
          tradeId: trade.id,
          userId: user.id,
          reason: body.reason,
        });
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
            data: { noShowCount: { increment: 1 }, riskScoreCached: { increment: 5 } },
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

    const updated = await loadTradeOrThrow(trade.id);
    return jsonOk({ trade: updated, safePlaces: SAFE_MEETING_PLACES });
  } catch (e) {
    if (e instanceof TradeError) return jsonError(e.message, e.status);
    return handleApiError(e);
  }
}
