import type { AppRequest } from "@/lib/http";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { computeRiskScore, MONEY_REASONS, scanContent } from "@/lib/antifraud";
import { refreshUserRisk } from "@/lib/services/risk";
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
  // Only files uploaded to this server — external links could bypass the filter
  mediaUrl: z
    .string()
    .regex(/^\/uploads\/[\w.-]+$/, "Недопустимое вложение")
    .optional(),
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
      const isMoney = flag.reasons.some((r) => MONEY_REASONS.has(r));
      const dbUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          moneyViolations: { increment: 1 },
          warningCount: { increment: 1 },
        },
      });

      await prisma.riskEvent.create({
        data: {
          userId: user.id,
          tradeId: trade.id,
          type: "CHAT_VIOLATION",
          score: computeRiskScore({
            moneyTalk: isMoney,
            externalContact: !isMoney,
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

      const risk = await refreshUserRisk(user.id);
      // TZ §26: repeated violations → account restriction
      if (
        dbUser.status !== "BLOCKED" &&
        (dbUser.moneyViolations >= 3 || risk.highRisk)
      ) {
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

    // Only the recipient replying starts negotiation; otherwise the initiator
    // could keep an offer alive past its 48h expiry just by chatting.
    if (trade.status === "OFFER_SENT" && user.id === trade.recipientId) {
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
