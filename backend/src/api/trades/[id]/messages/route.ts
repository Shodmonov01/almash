import type { AppRequest } from "@/lib/http";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { scanContent, computeRiskScore } from "@/lib/antifraud";
import { notify, writeAudit } from "@/lib/utils";
import {
  assertRateLimit,
  RateLimitError,
} from "@/lib/services/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: AppRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const trade = await prisma.trade.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
    });
    if (!trade) return jsonError("Не найдено", 404);
    if (
      trade.initiatorId !== user.id &&
      trade.recipientId !== user.id &&
      user.role !== "ADMIN"
    ) {
      return jsonError("Нет доступа", 403);
    }

    const messages = await prisma.message.findMany({
      where: { tradeId: trade.id },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    });

    const safe = messages.map((m) =>
      m.flagged && user.role !== "ADMIN"
        ? { ...m, body: "[сообщение скрыто фильтром безопасности]" }
        : m,
    );

    return jsonOk({
      messages: safe,
      tradeId: trade.id,
      publicId: trade.publicId,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const schema = z.object({
  body: z.string().min(1).max(4000),
  mediaUrl: z.string().optional(),
});

export async function POST(req: AppRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    await assertRateLimit(user.id, "send_message");
    const { id } = await ctx.params;
    const trade = await prisma.trade.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
    });
    if (!trade) return jsonError("Не найдено", 404);
    if (trade.initiatorId !== user.id && trade.recipientId !== user.id) {
      return jsonError("Нет доступа", 403);
    }
    if (["CANCELLED", "COMPLETED", "BLOCKED", "EXPIRED"].includes(trade.status)) {
      return jsonError("Чат закрыт", 400);
    }

    const data = schema.parse(await req.json());
    const allowContacts = [
      "TERMS_AGREED",
      "MEETING_SCHEDULED",
      "HANDOFF_PENDING",
      "PARTY_A_CONFIRMED",
      "PARTY_B_CONFIRMED",
    ].includes(trade.status);

    const flag = scanContent(data.body, { allowContacts });
    if (flag.blocked) {
      const dbUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          moneyViolations: { increment: 1 },
          warningCount: { increment: 1 },
          riskScoreCached: { increment: 10 },
        },
      });

      await prisma.riskEvent.create({
        data: {
          userId: user.id,
          tradeId: trade.id,
          type: "CHAT_VIOLATION",
          score: computeRiskScore({
            moneyTalk: true,
            isNewAccount: dbUser.completedTrades === 0,
          }),
          detail: flag.reasons.join(", "),
        },
      });

      await writeAudit({
        userId: user.id,
        tradeId: trade.id,
        action: "CHAT_FLAGGED",
        meta: { reasons: flag.reasons },
      });

      if (dbUser.moneyViolations >= 3 || dbUser.riskScoreCached >= 70) {
        await prisma.user.update({
          where: { id: user.id },
          data: { status: "LIMITED" },
        });
      }

      await prisma.message.create({
        data: {
          tradeId: trade.id,
          senderId: user.id,
          body: data.body,
          mediaUrl: data.mediaUrl,
          flagged: true,
          flagReason: flag.reasons.join(", "),
        },
      });

      return jsonError(flag.message, 400, {
        reasons: flag.reasons,
        warning: true,
      });
    }

    const message = await prisma.message.create({
      data: {
        tradeId: trade.id,
        senderId: user.id,
        body: data.body,
        mediaUrl: data.mediaUrl,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (trade.status === "OFFER_SENT") {
      await prisma.trade.update({
        where: { id: trade.id },
        data: { status: "NEGOTIATION" },
      });
    }

    const otherId =
      user.id === trade.initiatorId ? trade.recipientId : trade.initiatorId;
    await notify({
      userId: otherId,
      tradeId: trade.id,
      type: "MESSAGE",
      title: "Новое сообщение",
      body: `${user.name}: ${data.body.slice(0, 80)}`,
    });

    return jsonOk({ message });
  } catch (e) {
    if (e instanceof RateLimitError) return jsonError(e.message, 429);
    return handleApiError(e);
  }
}
